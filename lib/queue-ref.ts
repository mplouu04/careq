/**
 * Normalize queue lookup refs: uppercase, WALK5 → WALK-5, APPT12 → APPT-12
 */
export function normalizeQueueRef(raw: string): string {
  const ref = raw.trim().toUpperCase();
  const hyphenated = ref.match(/^(WALK|APPT)-(\d+)$/);
  if (hyphenated) return ref;

  const compact = ref.match(/^(WALK|APPT)(\d{1,4})$/);
  if (compact) return `${compact[1]}-${compact[2]}`;

  return ref;
}
