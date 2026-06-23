export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function toLocalPH(digits: string): string {
  if (digits.startsWith("63") && digits.length === 12) {
    return "0" + digits.slice(2);
  }
  return digits;
}

export function phonesMatchLast7(stored: string, incoming: string): boolean {
  const a = toLocalPH(normalizePhone(stored)).slice(-7);
  const b = toLocalPH(normalizePhone(incoming)).slice(-7);
  return a.length === 7 && a === b;
}
