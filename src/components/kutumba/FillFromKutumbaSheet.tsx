import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { FC, useState } from "react";

import { parseHttpError } from "@/lib/errors";

import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
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
  title = "Fill from Kutumba",
  confirmLabel = "Register Patient",
}) => {
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
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            Enter a Ration Card number to search for family members in the
            Kutumba database.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 pt-4">
          <Label htmlFor="rc-number" className="text-base">
            Ration Card Number
          </Label>
          <div className="flex gap-2">
            <Input
              id="rc-number"
              placeholder="Enter Ration Card number"
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
              Search
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
                  Searching Kutumba database...
                </p>
              </>
            )}

            {lookupMutation.isError &&
              (() => {
                const { message, referenceId } = parseHttpError(
                  lookupMutation.error,
                  "Failed to fetch members. Please try again.",
                );
                return (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
                    <p>{message}</p>
                    {referenceId && (
                      <p className="mt-1 text-xs opacity-75">
                        Reference: {referenceId}
                      </p>
                    )}
                  </div>
                );
              })()}

            {lookupMutation.isSuccess &&
              !showMemberCardSkeletons &&
              members.length === 0 && (
                <EmptyState
                  title="No members found"
                  description="No members were found for this Ration Card number."
                />
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
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedMemberIndex === null}
            >
              {confirmLabel}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default FillFromKutumbaSheet;
