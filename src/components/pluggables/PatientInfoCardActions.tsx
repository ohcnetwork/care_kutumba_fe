import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { FC, useState } from "react";
import { Trans } from "react-i18next";
import { toast } from "sonner";

import {
  ALL_MANAGED_TAG_IDS,
  ALL_RATION_TAG_IDS,
  GENDER_MAP,
  IDENTIFIER_FIELD_MAP,
  RC_TYPE_TO_TAG_ID,
  parseKutumbaDate,
} from "@/lib/kutumba-mappings";
import { mutate } from "@/lib/request";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

import FillFromKutumbaSheet from "@/components/kutumba/FillFromKutumbaSheet";

import { useTranslation } from "@/hooks/useTranslation";

import { patientApis } from "@/apis/kutumba";
import { kutumbaConfig } from "@/config";
import type { KutumbaMember } from "@/types/kutumba";
import type { PatientRead } from "@/types/patient";
import type { TagConfig } from "@/types/tagConfig";

type PatientInfoCardActionsProps = {
  patient: PatientRead;
  facilityId: string;
  className?: string;
};

interface Mismatch {
  fieldKey: string;
  patient: string;
  kutumba: string;
}

function detectMismatches(
  patient: PatientInfoCardActionsProps["patient"],
  member: KutumbaMember,
): Mismatch[] {
  const mismatches: Mismatch[] = [];

  // Name
  if (
    member.name &&
    patient.name &&
    member.name.toLowerCase() !== patient.name.toLowerCase()
  ) {
    mismatches.push({
      fieldKey: "field_name",
      patient: patient.name,
      kutumba: member.name,
    });
  }

  // Gender
  const kutumbaGender = member.gender ? GENDER_MAP[member.gender] : undefined;
  if (kutumbaGender && patient.gender && kutumbaGender !== patient.gender) {
    mismatches.push({
      fieldKey: "field_gender",
      patient: patient.gender,
      kutumba: kutumbaGender,
    });
  }

  // Date of birth
  const kutumbaDob = member.date_of_birth
    ? parseKutumbaDate(member.date_of_birth)
    : undefined;
  if (
    kutumbaDob &&
    patient.date_of_birth &&
    kutumbaDob !== patient.date_of_birth
  ) {
    mismatches.push({
      fieldKey: "field_date_of_birth",
      patient: patient.date_of_birth,
      kutumba: kutumbaDob,
    });
  }

  // Tags — show current vs incoming ration card tag
  const currentRationTag = patient.instance_tags.find((t) =>
    ALL_RATION_TAG_IDS.includes(t.id),
  );
  const newRationTagId = member.rc_type
    ? RC_TYPE_TO_TAG_ID[member.rc_type.toUpperCase()]
    : undefined;
  if (
    newRationTagId &&
    currentRationTag &&
    currentRationTag.id !== newRationTagId
  ) {
    const newTagDisplay = member.rc_type.toUpperCase();
    mismatches.push({
      fieldKey: "field_ration_card_type",
      patient: currentRationTag.display,
      kutumba: newTagDisplay,
    });
  }

  // Identifiers — compare existing RC number, health ID, education ID
  const identifiers = patient.instance_identifiers ?? [];
  for (const { configId, field } of IDENTIFIER_FIELD_MAP) {
    if (!configId) continue;
    const kutumbaValue = member[field];
    if (!kutumbaValue) continue;

    const existing = identifiers.find((i) => i.config.id === configId);
    if (existing && existing.value && existing.value !== String(kutumbaValue)) {
      const labelKey =
        field === "rc_number"
          ? "field_rc_number"
          : field === "health_id"
            ? "field_health_id"
            : "field_education_id";
      mismatches.push({
        fieldKey: labelKey,
        patient: existing.value,
        kutumba: String(kutumbaValue),
      });
    }
  }

  return mismatches;
}

async function syncTagsAndIdentifiers(
  patientId: string,
  member: KutumbaMember,
  currentTags: TagConfig[],
) {
  const pathParams = { id: patientId };

  // Determine which managed tags the patient currently has
  const currentManagedTagIds = currentTags
    .map((t) => t.id)
    .filter((id) => ALL_MANAGED_TAG_IDS.includes(id));

  // Determine new tags from the Kutumba member
  const newTagIds = Array.from(
    new Set(
      [
        member.rc_type
          ? RC_TYPE_TO_TAG_ID[member.rc_type.toUpperCase()]
          : undefined,
        member.education_id ? kutumbaConfig.studentUnverifiedTagId : undefined,
        member.disability_applicant_no
          ? kutumbaConfig.pwdUnverifiedTagId
          : undefined,
      ].filter((id): id is string => Boolean(id)),
    ),
  );

  const existingTagIds = currentTags.map((t) => t.id);
  const tagsToAdd = newTagIds.filter((id) => !existingTagIds.includes(id));
  const tagsToRemove = currentManagedTagIds.filter(
    (id) => !newTagIds.includes(id),
  );

  // Add new tags first, then update identifiers sequentially, then remove obsolete tags.
  if (tagsToAdd.length > 0) {
    await mutate(patientApis.setInstanceTags, { pathParams })({
      tags: tagsToAdd,
    });
  }

  for (const { configId, field } of IDENTIFIER_FIELD_MAP) {
    if (!configId) continue;
    const value = member[field];
    if (!value) continue;

    await mutate(patientApis.updateIdentifier, { pathParams })({
      config: configId,
      value: String(value),
    });
  }

  // Only remove obsolete managed tags after all additive updates succeed.
  if (tagsToRemove.length > 0) {
    await mutate(patientApis.removeInstanceTags, { pathParams })({
      tags: tagsToRemove,
    });
  }
}

const PatientInfoCardActions: FC<PatientInfoCardActionsProps> = ({
  patient,
  className,
}) => {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetInstanceId, setSheetInstanceId] = useState(0);
  const [pendingMember, setPendingMember] = useState<KutumbaMember | null>(
    null,
  );
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async ({ member }: { member: KutumbaMember }) => {
      await syncTagsAndIdentifiers(patient.id, member, patient.instance_tags);
    },
    onSuccess: (_data, { member }) => {
      setSheetInstanceId((id) => id + 1);
      toast.success(t("kutumba_data_synced", { name: member.name }));
    },
    onError: () => {
      toast.error(t("failed_to_sync_kutumba_data"));
    },
    onSettled: () => {
      setPendingMember(null);
      queryClient.invalidateQueries({ queryKey: ["patient-verify"] });
    },
  });

  const handleMemberSelect = (member: KutumbaMember) => {
    setPendingMember(member);
  };

  const handleConfirmSync = () => {
    if (pendingMember) {
      syncMutation.mutate({ member: pendingMember });
    }
  };

  return (
    <div className={`care-kutumba-fe-container ${className ?? ""}`}>
      <Button
        type="button"
        variant="outline"
        className="text-primary border-primary"
        onClick={() => setSheetOpen(true)}
        disabled={syncMutation.isPending}
      >
        {syncMutation.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        {t("sync_from_kutumba")}
      </Button>

      <FillFromKutumbaSheet
        key={sheetInstanceId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMemberSelect={handleMemberSelect}
        title={t("sync_from_kutumba")}
        confirmLabel={t("sync_patient")}
      />

      <AlertDialog
        open={pendingMember !== null && !syncMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMember(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("sync_from_kutumba_question")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  <Trans
                    i18nKey="sync_from_kutumba_description"
                    ns="care_kutumba_fe_fe"
                    values={{
                      name: pendingMember?.name ?? "",
                      rc_number: pendingMember?.rc_number ?? "",
                    }}
                    components={{ b: <strong /> }}
                  />
                </p>

                {pendingMember &&
                  (() => {
                    const mismatches = detectMismatches(patient, pendingMember);
                    if (mismatches.length === 0) return null;
                    return (
                      <>
                        <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950">
                          <div className="flex items-center gap-2 font-medium text-yellow-800 dark:text-yellow-300">
                            <AlertTriangle className="size-4" />
                            {t("data_mismatch_detected")}
                          </div>
                          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                            {t("data_mismatch_description")}
                          </p>
                        </div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-gray-600 dark:text-gray-400">
                              <th className="py-2 pr-3 font-semibold">
                                {t("field")}
                              </th>
                              <th className="py-2 pr-3 font-semibold">
                                {t("current_record")}
                              </th>
                              <th className="py-2 font-semibold">
                                {t("from_kutumba")}
                              </th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-700 dark:text-gray-300">
                            {mismatches.map((m) => (
                              <tr
                                key={m.fieldKey}
                                className="border-b border-gray-100 dark:border-gray-800"
                              >
                                <td className="py-2 pr-3 font-medium">
                                  {t(m.fieldKey)}
                                </td>
                                <td className="py-2 pr-3">{m.patient}</td>
                                <td className="py-2">{m.kutumba}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSync}>
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientInfoCardActions;
