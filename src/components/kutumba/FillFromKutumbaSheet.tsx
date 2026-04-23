import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { FC, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useTranslation } from "@/hooks/useTranslation";

import { kutumbaApis } from "@/apis/kutumba";
import type { KutumbaMember } from "@/types/kutumba";

import MemberCard from "./MemberCard";
import MemberCardSkeleton from "./MemberCardSkeleton";

interface FillFromKutumbaSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberSelect: (member: KutumbaMember, allMembers: KutumbaMember[]) => void;
  title?: string;
  confirmLabel?: string;
}

const FillFromKutumbaSheet: FC<FillFromKutumbaSheetProps> = ({
  open,
  onOpenChange,
  onMemberSelect,
  title,
  confirmLabel,
}) => {
  const { t } = useTranslation();
  const [rcNumber, setRcNumber] = useState("");
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number | null>(
    null,
  );

  const lookupMutation = useMutation({
    mutationFn: kutumbaApis.lookupByRcNumber,
    onSuccess: () => {
      setSelectedMemberIndex(null);
    },
  });

  const handleSearch = () => {
    if (!rcNumber.trim()) return;
    lookupMutation.mutate({ rc_number: rcNumber.trim() });
  };

  const handleConfirm = () => {
    if (selectedMemberIndex !== null && members[selectedMemberIndex]) {
      onMemberSelect(members[selectedMemberIndex], members);
      onOpenChange(false);
    }
  };

  const members = lookupMutation.data?.members ?? [];
  const showMemberCardSkeletons = lookupMutation.isPending;

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) setSelectedMemberIndex(null);
        onOpenChange(isOpen);
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title ?? t("fill_from_kutumba")}</SheetTitle>
          <SheetDescription>
            {t("ration_card_search_description")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 pt-4">
          <Label htmlFor="rc-number" className="text-base">
            {t("ration_card_number")}
          </Label>
          <div className="flex gap-2">
            <Input
              id="rc-number"
              placeholder={t("enter_ration_card_number")}
              value={rcNumber}
              onChange={(e) => setRcNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
            />
            <Button
              onClick={handleSearch}
              disabled={!rcNumber.trim() || lookupMutation.isPending}
              size="default"
            >
              {lookupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {t("search")}
            </Button>
          </div>
        </div>

        <ScrollArea className="mt-4 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3">
            {showMemberCardSkeletons && (
              <>
                {Array.from({ length: 3 }, (_, index) => (
                  <MemberCardSkeleton key={index} />
                ))}
                <p className="px-1 text-center text-sm text-gray-500">
                  {t("searching_kutumba_database")}
                </p>
              </>
            )}

            {lookupMutation.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                {t("failed_to_fetch_members")}
              </div>
            )}

            {lookupMutation.isSuccess &&
              !showMemberCardSkeletons &&
              members.length === 0 && (
                <div className="py-12 text-center text-sm text-gray-500">
                  {t("no_members_found")}
                </div>
              )}

            {!showMemberCardSkeletons &&
              members.map((member, index) => (
                <MemberCard
                  key={member.health_id || index}
                  member={member}
                  selected={selectedMemberIndex === index}
                  onSelect={() => setSelectedMemberIndex(index)}
                />
              ))}
          </div>
        </ScrollArea>

        {members.length > 0 && (
          <SheetFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedMemberIndex === null}
            >
              {confirmLabel ?? t("register_patient")}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FillFromKutumbaSheet;
