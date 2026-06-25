export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function toLocalPH(digits: string): string {
  if (digits.startsWith("63") && digits.length === 12) {
    return "0" + digits.slice(2);
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return "0" + digits;
  }
  return digits;
}

export function extractPhoneLast7(phone: string): string {
  return toLocalPH(normalizePhone(phone)).slice(-7);
}

export function phonesMatchLast7(stored: string, incoming: string): boolean {
  const a = extractPhoneLast7(stored);
  const b = extractPhoneLast7(incoming);
  return a.length === 7 && a === b;
}

/** Match on full local PH number when available, otherwise last-7 digits. */
export function phonesMatch(stored: string, incoming: string): boolean {
  if (!stored?.trim() || !incoming?.trim()) return false;
  const localStored = toLocalPH(normalizePhone(stored));
  const localIncoming = toLocalPH(normalizePhone(incoming));
  if (localStored.length >= 10 && localIncoming.length >= 10 && localStored === localIncoming) {
    return true;
  }
  return phonesMatchLast7(stored, incoming);
}

export function patientPhonesMatch(
  patient: { phone?: string | null; phone_normalized?: string | null } | null | undefined,
  incoming: string
): boolean {
  if (!patient) return false;
  return (
    phonesMatch(patient.phone || "", incoming) ||
    phonesMatch(patient.phone_normalized || "", incoming)
  );
}
