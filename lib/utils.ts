import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Trim a string value and enforce a maximum length. Returns empty string for non-strings. */
export function sanitize(value: unknown, maxLen = 255): string {
  if (value === null || value === undefined) return "";
  return String(value).trim().slice(0, maxLen);
}

/** Basic email format validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Check a string matches an alphanumeric reference format (letters, digits, hyphens). */
export function isValidRef(ref: string): boolean {
  return /^[A-Za-z0-9\-]{3,30}$/.test(ref);
}
