export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function phonesMatchLast7(stored: string, incoming: string): boolean {
  const a = normalizePhone(stored).slice(-7);
  const b = normalizePhone(incoming).slice(-7);
  return a.length === 7 && a === b;
}
