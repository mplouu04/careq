const VERIFY_TOKEN_KEY = "careq_verify_token";

export function storeVerifyToken(token: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(VERIFY_TOKEN_KEY, token);
}

export function readVerifyToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(VERIFY_TOKEN_KEY);
}

export function clearVerifyToken(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(VERIFY_TOKEN_KEY);
}
