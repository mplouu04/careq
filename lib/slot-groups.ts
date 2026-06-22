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

export type HourSlotGroup = {
  hour: number;
  label: string;
  slots: string[];
};

function formatHourLabel(hour: number): string {
  const h12 = hour % 12 || 12;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${h12}:00 ${ampm}`;
}

/** Group slots into hourly blocks (e.g. 8:00 AM – 9:00 AM). */
export function groupSlotsByHour(slots: string[]): HourSlotGroup[] {
  const byHour = new Map<number, string[]>();

  for (const slot of slots) {
    const hour = parseInt(slot.slice(0, 2), 10);
    const list = byHour.get(hour) ?? [];
    list.push(slot);
    byHour.set(hour, list);
  }

  return Array.from(byHour.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, hourSlots]) => ({
      hour,
      label: `${formatHourLabel(hour)} – ${formatHourLabel((hour + 1) % 24)}`,
      slots: hourSlots.sort(),
    }));
}

export function firstHourWithSlots(groups: HourSlotGroup[]): number | null {
  return groups[0]?.hour ?? null;
}

export function hourForSlot(slot: string): number {
  return parseInt(slot.slice(0, 2), 10);
}
