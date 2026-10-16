/**
 * Normalize room display names to avoid "Room Room 3" when UI already says "Room".
 */

const ROOM_PREFIX = /^room\s+/i;

/** Strip a leading "Room " prefix for use under a "Room" column/header. */
export function roomNameWithoutPrefix(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  return raw.replace(ROOM_PREFIX, "").trim() || raw;
}

/** Full display label (keeps "Room N" if that is the stored name). */
export function formatRoomName(name: string | null | undefined): string {
  return (name ?? "").trim();
}

/**
 * When the UI already prefixes with "Room", return the short form.
 * e.g. labelPrefix="Room", name="Room 3" → "3"
 */
export function roomLabelForPrefixedUi(
  name: string | null | undefined,
  labelPrefix = "Room"
): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  const prefix = labelPrefix.trim();
  if (!prefix) return raw;
  const re = new RegExp(`^${prefix}\\s+`, "i");
  if (re.test(raw)) return raw.replace(re, "").trim() || raw;
  return raw;
}
