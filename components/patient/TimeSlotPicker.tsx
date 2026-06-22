"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  firstHourWithSlots,
  firstPeriodWithSlots,
  groupSlotsByHour,
  groupSlotsByPeriod,
  hourForSlot,
  SLOT_PERIOD_LABELS,
  type SlotPeriod,
} from "@/lib/slot-groups";
import { Skeleton } from "@/components/ui/skeleton";

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

function SlotButton({
  slot,
  selected,
  onSelect,
}: {
  slot: string;
  selected: string;
  onSelect: (slot: string) => void;
}) {
  const isSelected = selected === slot;
  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      className={cn(
        "rounded-xl px-2 py-2 text-body-sm font-medium border transition-colors min-h-[44px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !isSelected &&
          "border-outline-variant bg-white text-on-surface hover:border-primary/40 hover:bg-primary/5",
        isSelected && "border-primary bg-primary text-white shadow-sm"
      )}
      aria-pressed={isSelected}
    >
      {formatTime12h(slot)}
    </button>
  );
}

function HourlySlotAccordion({
  periodSlots,
  selected,
  onSelect,
}: {
  periodSlots: string[];
  selected: string;
  onSelect: (slot: string) => void;
}) {
  const hourGroups = useMemo(() => groupSlotsByHour(periodSlots), [periodSlots]);
  const [expandedHour, setExpandedHour] = useState<number | null>(null);

  useEffect(() => {
    if (selected) {
      setExpandedHour(hourForSlot(selected));
      return;
    }
    setExpandedHour(firstHourWithSlots(hourGroups));
  }, [hourGroups, selected]);

  if (periodSlots.length === 0) {
    return (
      <p className="text-body-sm text-on-surface-variant py-4">
        No slots in this period.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hourGroups.map((group) => {
        const isExpanded = expandedHour === group.hour;
        const timesLabel = group.slots.length === 1 ? "1 time" : `${group.slots.length} times`;

        return (
          <div
            key={group.hour}
            className="rounded-xl border border-outline-variant bg-white overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedHour(isExpanded ? null : group.hour)}
              className={cn(
                "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors min-h-[52px]",
                "hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              )}
              aria-expanded={isExpanded}
            >
              <span className="text-body-sm font-semibold text-on-surface">
                {group.label}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-body-sm text-on-surface-variant">{timesLabel}</span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-on-surface-variant" aria-hidden />
                ) : (
                  <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-outline-variant px-4 pb-4 pt-3">
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {group.slots.map((slot) => (
                    <SlotButton
                      key={slot}
                      slot={slot}
                      selected={selected}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LoadingAccordion() {
  return (
    <div className="space-y-2" aria-label="Loading time slots" role="status">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-[52px] w-full rounded-xl" />
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
    if (!first) return;
    setActivePeriod((current) =>
      availablePeriods.includes(current) ? current : first
    );
  }, [groups, dateLabel, availablePeriods]);

  return (
    <div>
      {dateLabel && (
        <h3 className="text-headline-sm text-on-surface mb-4">
          Available times — {dateLabel}
        </h3>
      )}

      {loading ? (
        <LoadingAccordion />
      ) : slots.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">
          No slots available for this date.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {availablePeriods.map((period) => {
              const isActive = activePeriod === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => setActivePeriod(period)}
                  className={cn(
                    "rounded-full px-4 py-2 text-body-sm font-medium border transition-colors min-h-[40px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !isActive &&
                      "border-outline-variant text-on-surface hover:border-primary/40 hover:bg-primary/5",
                    isActive && "border-primary bg-primary text-white shadow-sm"
                  )}
                  aria-pressed={isActive}
                >
                  {SLOT_PERIOD_LABELS[period]} · {groups[period].length}
                </button>
              );
            })}
          </div>

          <HourlySlotAccordion
            periodSlots={groups[activePeriod]}
            selected={selected}
            onSelect={onSelect}
          />
        </>
      )}
    </div>
  );
}
