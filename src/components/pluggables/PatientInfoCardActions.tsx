import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { FC, useEffect, useState } from "react";
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

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

import { patientApis } from "@/apis/kutumba";
import { kutumbaConfig } from "@/config";
import type { KutumbaMember } from "@/types/kutumba";
import type { PatientRead } from "@/types/patient";

type PatientInfoCardActionsProps = {
  patient: PatientRead;
  facilityId: string;
  className?: string;
};

interface IdentityMismatch {
  field: string;
  patient: string;
  kutumba: string;
}

interface ChangeRow {
  field: string;
  current: string | null;
  incoming: string;
  kind: "added" | "updated";
  /** When true, render the value as a tag-style badge instead of mono identifier text. */
  isTag?: boolean;
}

/**
 * Concrete list of API operations the sync should perform.
 * Built once by `computeSyncPreview` and consumed verbatim by
 * `syncTagsAndIdentifiers`, so the dialog and the writer can never disagree.
 */
interface SyncPlan {
  tagsToAdd: string[];
  tagsToRemove: string[];
  identifiersToWrite: { configId: string; value: string }[];
}

function identifierLabel(field: string): string {
  if (field === "rc_number") return "RC Number";
  if (field === "health_id") return "Health ID";
  if (field === "education_id") return "Education ID";
  return field;
}

/**
 * Computes a preview of what `syncTagsAndIdentifiers` would do, split into:
 *  - `changes`     — fields the sync will actually write (ration tag + identifiers)
 *  - `identityMismatches` — fields the sync will NOT touch but that differ from
 *                     the selected Kutumba member, useful as a "are you sure
 *                     this is the same person?" verification step.
 */
function computeSyncPreview(
  patient: PatientInfoCardActionsProps["patient"],
  member: KutumbaMember,
): {
  changes: ChangeRow[];
  identityMismatches: IdentityMismatch[];
  plan: SyncPlan;
} {
  const identityMismatches: IdentityMismatch[] = [];
  const changes: ChangeRow[] = [];
  const identifiersToWrite: SyncPlan["identifiersToWrite"] = [];

  // ----- Identity-only fields (never written by sync) -----
  // Warn whenever the two sides differ, including when one side is empty,
  // so the user can spot missing data on either side. Empty values render as "N/A".

  if (
    (member.name ?? "").toLowerCase() !== (patient.name ?? "").toLowerCase()
  ) {
    identityMismatches.push({
      field: "Name",
      patient: patient.name || "N/A",
      kutumba: member.name || "N/A",
    });
  }

  const kutumbaGender = member.gender ? GENDER_MAP[member.gender] : undefined;
  if ((kutumbaGender ?? "") !== (patient.gender ?? "")) {
    identityMismatches.push({
      field: "Gender",
      patient: patient.gender || "N/A",
      kutumba: kutumbaGender || "N/A",
    });
  }

  const kutumbaDob = member.date_of_birth
    ? parseKutumbaDate(member.date_of_birth)
    : undefined;
  if ((kutumbaDob ?? "") !== (patient.date_of_birth ?? "")) {
    identityMismatches.push({
      field: "Date of Birth",
      patient: patient.date_of_birth || "N/A",
      kutumba: kutumbaDob || "N/A",
    });
  }

  // Phone number — warning only, sync never overwrites it.
  // Compare on last 10 digits to ignore +91 prefix and formatting differences.
  const normalisePhone = (v?: string | null) => {
    const digits = v ? v.replace(/\D/g, "") : "";
    return digits.length >= 10 ? digits.slice(-10) : "";
  };
  const kutumbaMobile = normalisePhone(member.mobile_no);
  const patientMobile = normalisePhone(patient.phone_number);
  if (kutumbaMobile !== patientMobile) {
    identityMismatches.push({
      field: "Phone Number",
      patient: patient.phone_number || "N/A",
      kutumba: member.mobile_no || "N/A",
    });
  }

  // ----- Fields the sync will actually write -----

  // Ration card tag
  const currentRationTags = patient.instance_tags.filter((t) =>
    ALL_RATION_TAG_IDS.includes(t.id),
  );
  const newRationTagId = member.rc_type
    ? RC_TYPE_TO_TAG_ID[member.rc_type.toUpperCase()]
    : undefined;
  if (newRationTagId) {
    const incomingDisplay = member.rc_type!.toUpperCase();
    const matching = currentRationTags.find((t) => t.id === newRationTagId);
    const stale = currentRationTags.filter((t) => t.id !== newRationTagId);

    if (currentRationTags.length === 0) {
      changes.push({
        field: "Ration Card Type",
        current: null,
        incoming: incomingDisplay,
        kind: "added",
        isTag: true,
      });
    } else if (!matching) {
      // Patient has ration tag(s), none match — replacing them all.
      changes.push({
        field: "Ration Card Type",
        current: stale.map((t) => t.display).join(", "),
        incoming: incomingDisplay,
        kind: "updated",
        isTag: true,
      });
    } else if (stale.length > 0) {
      // Correct tag is present, but extra stale ration tags will be removed.
      changes.push({
        field: "Ration Card Type",
        current: currentRationTags.map((t) => t.display).join(", "),
        incoming: incomingDisplay,
        kind: "updated",
        isTag: true,
      });
    }
  }

  // Identifiers — RC number, health ID, education ID
  const identifiers = patient.instance_identifiers ?? [];
  for (const { configId, field } of IDENTIFIER_FIELD_MAP) {
    if (!configId) continue;
    const kutumbaValue = member[field];
    if (!kutumbaValue) continue;

    const existing = identifiers.find((i) => i.config.id === configId);
    const existingValue = existing?.value?.trim() ?? "";
    const incoming = String(kutumbaValue);
    const label = identifierLabel(field);

    if (!existingValue) {
      changes.push({
        field: label,
        current: null,
        incoming,
        kind: "added",
      });
      identifiersToWrite.push({ configId, value: incoming });
    } else if (existingValue !== incoming) {
      changes.push({
        field: label,
        current: existingValue,
        incoming,
        kind: "updated",
      });
      identifiersToWrite.push({ configId, value: incoming });
    }
    // else: identifier already up to date — no API call needed.
  }

  // ----- Tag plan (mirrors the old writer's diff) -----
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
  const existingTagIds = patient.instance_tags.map((t) => t.id);
  const currentManagedTagIds = existingTagIds.filter((id) =>
    ALL_MANAGED_TAG_IDS.includes(id),
  );
  const tagsToAdd = newTagIds.filter((id) => !existingTagIds.includes(id));
  const tagsToRemove = currentManagedTagIds.filter(
    (id) => !newTagIds.includes(id),
  );

  return {
    changes,
    identityMismatches,
    plan: { tagsToAdd, tagsToRemove, identifiersToWrite },
  };
}

/**
 * Executes a {@link SyncPlan} against the core CARE patient APIs.
 *
 * Order matters: add new tags first, then write identifiers, then remove
 * obsolete tags last — so the patient is never left without a classification
 * if an earlier step fails.
 */
async function syncTagsAndIdentifiers(patientId: string, plan: SyncPlan) {
  const pathParams = { id: patientId };

  if (plan.tagsToAdd.length > 0) {
    await mutate(patientApis.setInstanceTags, { pathParams })({
      tags: plan.tagsToAdd,
    });
  }

  for (const { configId, value } of plan.identifiersToWrite) {
    await mutate(patientApis.updateIdentifier, { pathParams })({
      config: configId,
      value,
    });
  }

  if (plan.tagsToRemove.length > 0) {
    await mutate(patientApis.removeInstanceTags, { pathParams })({
      tags: plan.tagsToRemove,
    });
  }
}

const ValueText: FC<{
  value: string;
  isTag?: boolean;
  muted?: boolean;
}> = ({ value, isTag, muted }) => {
  if (isTag) {
    // Match care_fe `Badge` (variant=secondary, size=sm). Render each
    // comma-separated value as its own badge.
    const badgeClass = muted
      ? "inline-flex items-center rounded-md border border-gray-300 bg-gray-100 px-2.5 py-px text-sm font-medium text-gray-500"
      : "inline-flex items-center rounded-md border border-gray-300 bg-gray-100 px-2.5 py-px text-sm font-medium text-gray-900";
    const parts = value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {parts.map((p) => (
          <span key={p} className={badgeClass}>
            {p}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span
      className={
        muted
          ? "text-sm text-gray-500 font-medium"
          : "text-sm text-gray-900 font-medium"
      }
    >
      {value}
    </span>
  );
};

const PatientInfoCardActions: FC<PatientInfoCardActionsProps> = ({
  patient,
  className,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetInstanceId, setSheetInstanceId] = useState(0);
  const [pendingMember, setPendingMember] = useState<KutumbaMember | null>(
    null,
  );
  const [identityVerified, setIdentityVerified] = useState(false);
  const queryClient = useQueryClient();

  // Reset the identity-verification checkbox whenever a new member is picked.
  useEffect(() => {
    setIdentityVerified(false);
  }, [pendingMember]);

  const syncMutation = useMutation({
    mutationFn: async ({ plan }: { plan: SyncPlan }) => {
      await syncTagsAndIdentifiers(patient.id, plan);
    },
    onSuccess: () => {
      setSheetInstanceId((id) => id + 1);
      toast.success(`Synced ${patient.name} from Kutumba`);
    },
    onError: () => {
      toast.error("Failed to sync Kutumba data. Please try again.");
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
      const { plan } = computeSyncPreview(patient, pendingMember);
      syncMutation.mutate({ plan });
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
        Sync from Kutumba
      </Button>

      <FillFromKutumbaSheet
        key={sheetInstanceId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onMemberSelect={handleMemberSelect}
        title="Sync from Kutumba"
        confirmLabel="Sync Patient"
      />

      <AlertDialog
        open={pendingMember !== null && !syncMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingMember(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          {pendingMember &&
            (() => {
              const { changes, identityMismatches } = computeSyncPreview(
                patient,
                pendingMember,
              );
              const hasChanges = changes.length > 0;
              const needsIdentityConfirm = identityMismatches.length > 0;
              const confirmDisabled =
                !hasChanges || (needsIdentityConfirm && !identityVerified);
              const confirmLabel = hasChanges
                ? `Apply ${changes.length} change${changes.length === 1 ? "" : "s"}`
                : "No changes";

              return (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Sync ration card details from Kutumba
                    </AlertDialogTitle>
                    <AlertDialogDescription className="sr-only">
                      Review the ration card tag and identifier changes that
                      will be applied to this patient before confirming.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Source: <strong>{pendingMember.name}</strong>
                      {pendingMember.rc_number && (
                        <>
                          {" "}
                          &middot; RC{" "}
                          <span className="font-mono">
                            {pendingMember.rc_number}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Section 1: what will actually change */}
                    <section
                      aria-labelledby="kutumba-sync-changes-heading"
                      className="rounded-md border border-primary/30 bg-primary/5 p-3"
                    >
                      <h3
                        id="kutumba-sync-changes-heading"
                        className="flex items-center gap-2 text-sm font-semibold text-primary"
                      >
                        <RefreshCw className="size-4" />
                        What will change
                      </h3>

                      {!hasChanges ? (
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          This patient is already in sync with Kutumba. No
                          changes will be made.
                        </p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {changes.map((c) => (
                            <li
                              key={c.field}
                              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
                            >
                              <span className="min-w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                                {c.field}
                              </span>
                              <span className="flex flex-1 flex-wrap items-center gap-2">
                                {c.kind === "updated" && (
                                  <>
                                    <ValueText
                                      value={c.current ?? ""}
                                      isTag={c.isTag}
                                      muted
                                    />
                                    <ArrowRight className="size-3.5 text-gray-400" />
                                  </>
                                )}
                                <ValueText value={c.incoming} isTag={c.isTag} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    {/* Section 2: identity verification (only when there are
                        actual changes to apply AND identity differs) */}
                    {hasChanges && needsIdentityConfirm && (
                      <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                        <AlertTitle className="col-start-1 col-span-2 flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="size-4" />
                          Details don't match
                        </AlertTitle>
                        <AlertDescription className="col-span-2 col-start-1 mt-2 text-amber-900 dark:text-amber-50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-amber-300/60 text-left text-xs uppercase tracking-wide text-amber-900/70 bg-amber-100">
                                <th className="px-3 py-2 font-semibold">
                                  Field
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  Patient record
                                </th>
                                <th className="px-3 py-2 font-semibold">
                                  Kutumba
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {identityMismatches.map((m) => (
                                <tr
                                  key={m.field}
                                  className="border-b border-amber-200/60 last:border-0 dark:border-amber-800/40"
                                >
                                  <td className="px-3 py-2 font-medium">
                                    {m.field}
                                  </td>
                                  <td className="px-3 py-2">{m.patient}</td>
                                  <td className="px-3 py-2">{m.kutumba}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>

                          <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-amber-900 dark:text-amber-50">
                            <input
                              type="checkbox"
                              className="size-4 rounded border-amber-400 text-primary focus:ring-primary"
                              checked={identityVerified}
                              onChange={(e) =>
                                setIdentityVerified(e.target.checked)
                              }
                            />
                            I've verified this is the correct person
                          </label>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <AlertDialogFooter>
                    {hasChanges ? (
                      <>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleConfirmSync}
                          disabled={confirmDisabled}
                        >
                          {confirmLabel}
                        </AlertDialogAction>
                      </>
                    ) : (
                      <AlertDialogCancel>Close</AlertDialogCancel>
                    )}
                  </AlertDialogFooter>
                </>
              );
            })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PatientInfoCardActions;
