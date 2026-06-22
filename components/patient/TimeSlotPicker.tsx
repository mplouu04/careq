"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  firstPeriodWithSlots,
  groupSlotsByPeriod,
  SLOT_PERIOD_LABELS,
  type SlotPeriod,
} from "@/lib/slot-groups";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr ?? "00"} ${ampm}`;
}

type TimeSlotPickerProps = {
  slots: string[];
  selected: string;
  onSelect: (slot: string) => void;
  dateLabel?: string;
  loading?: boolean;
};

function SlotGrid({
  periodSlots,
  selected,
  onSelect,
}: {
  periodSlots: string[];
  selected: string;
  onSelect: (slot: string) => void;
}) {
  if (periodSlots.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant py-4">
        No slots in this period.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {periodSlots.map((slot) => {
        const isSelected = selected === slot;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelect(slot)}
            className={cn(
              "rounded-xl px-3 py-2 text-body-sm font-medium border transition-colors min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !isSelected &&
                "border-outline-variant text-on-surface hover:border-primary/40 hover:bg-primary/5",
              isSelected && "border-primary bg-primary text-white shadow-sm"
            )}
            aria-pressed={isSelected}
          >
            {formatTime12h(slot)}
          </button>
        );
      })}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div
      className="grid grid-cols-3 sm:grid-cols-4 gap-2"
      aria-label="Loading time slots"
      role="status"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="h-11 rounded-xl" />
      ))}
    </div>
  );
}

export function TimeSlotPicker({
  slots,
  selected,
  onSelect,
  dateLabel,
  loading = false,
}: TimeSlotPickerProps) {
  const groups = useMemo(() => groupSlotsByPeriod(slots), [slots]);
  const availablePeriods = useMemo(
    () =>
      (["morning", "afternoon", "evening"] as const).filter(
        (p) => groups[p].length > 0
      ),
    [groups]
  );

  const [activePeriod, setActivePeriod] = useState<SlotPeriod>("morning");

  useEffect(() => {
    const first = firstPeriodWithSlots(groups);
    if (first) setActivePeriod(first);
  }, [groups, dateLabel]);

  return (
    <div>
      {dateLabel && (
        <h3 className="text-headline-sm text-on-surface mb-4">
          Available times — {dateLabel}
        </h3>
      )}

      {loading ? (
        <LoadingGrid />
      ) : slots.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">
          No slots available for this date.
        </p>
      ) : (
        <Tabs
          value={activePeriod}
          onValueChange={(value) => {
            if (value) setActivePeriod(value as SlotPeriod);
          }}
        >
          <TabsList className="w-full sm:w-auto h-auto flex-wrap gap-1 p-1 mb-4">
            {availablePeriods.map((period) => (
              <TabsTrigger
                key={period}
                value={period}
                className="min-h-9 px-3 py-1.5 text-body-sm"
              >
                {SLOT_PERIOD_LABELS[period]}
                <span className="ml-1 text-on-surface-variant data-active:text-inherit">
                  · {groups[period].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {availablePeriods.map((period) => (
            <TabsContent key={period} value={period} className="mt-0">
              <SlotGrid
                periodSlots={groups[period]}
                selected={selected}
                onSelect={onSelect}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
