export type SlotPeriod = "morning" | "afternoon" | "evening";

const PERIOD_ORDER: SlotPeriod[] = ["morning", "afternoon", "evening"];

export function groupSlotsByPeriod(slots: string[]): Record<SlotPeriod, string[]> {
  const groups: Record<SlotPeriod, string[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    const hour = parseInt(slot.slice(0, 2), 10);
    if (hour < 12) groups.morning.push(slot);
    else if (hour < 17) groups.afternoon.push(slot);
    else groups.evening.push(slot);
  }

  return groups;
}

export function firstPeriodWithSlots(
  groups: Record<SlotPeriod, string[]>
): SlotPeriod | null {
  for (const period of PERIOD_ORDER) {
    if (groups[period].length > 0) return period;
  }
  return null;
}

export const SLOT_PERIOD_LABELS: Record<SlotPeriod, string> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
};
