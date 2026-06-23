/**
 * Helpers for patient search query building (unit-tested).
 */
export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isDigitsOnly(term: string): boolean {
  return /^\d+$/.test(term.trim());
}

export function splitSearchTokens(term: string): string[] {
  return term
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function escapePostgrestValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '""');
}

export function ilikePattern(term: string): string {
  return `%${term.trim()}%`;
}

export function minSearchLength(term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  if (isDigitsOnly(t)) return t.length >= 4;
  return t.length >= 2;
}
