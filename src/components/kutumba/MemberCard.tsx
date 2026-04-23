import { Check, User } from "lucide-react";
import { FC } from "react";

import { cn } from "@/lib/utils";

import { Card, CardContent } from "@/components/ui/card";

import { useTranslation } from "@/hooks/useTranslation";

import type { KutumbaMember } from "@/types/kutumba";

interface MemberCardProps {
  member: KutumbaMember;
  selected: boolean;
  onSelect: () => void;
}

const MemberCard: FC<MemberCardProps> = ({ member, selected, onSelect }) => {
  const { t } = useTranslation();
  const genderLabel =
    { M: t("male"), F: t("female"), O: t("other") }[member.gender] ??
    member.gender;

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all hover:border-primary-500",
        selected
          ? "border-2 border-primary-700 bg-primary-50 dark:border-primary-400 dark:bg-primary-950"
          : "border border-gray-200",
      )}
      onClick={onSelect}
    >
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800",
            selected && "bg-primary-100 dark:bg-primary-900",
          )}
        >
          {selected ? (
            <Check className="h-5 w-5 text-primary-700 dark:text-primary-400" />
          ) : (
            <User className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              {member.name}
            </p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              {member.relation_name}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
            {member.date_of_birth && (
              <span>{t("member_dob", { value: member.date_of_birth })}</span>
            )}
            {member.gender && (
              <span>{t("member_gender", { value: genderLabel })}</span>
            )}
            {member.mobile_no && (
              <span>{t("member_mobile", { value: member.mobile_no })}</span>
            )}
            {member.rc_number && (
              <span>{t("member_rc", { value: member.rc_number })}</span>
            )}
            {member.pincode && (
              <span>{t("member_pincode", { value: member.pincode })}</span>
            )}
            {member.health_id && (
              <span className="col-span-2">
                {t("member_health_id", { value: member.health_id })}
              </span>
            )}
            {member.education_id && (
              <span className="col-span-2">
                {t("member_education_id", { value: member.education_id })}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MemberCard;
