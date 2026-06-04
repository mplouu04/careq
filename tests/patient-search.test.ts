import { describe, it, expect } from "vitest";
import {
  normalizePhoneDigits,
  isDigitsOnly,
  splitSearchTokens,
  escapePostgrestValue,
  ilikePattern,
  minSearchLength,
} from "../lib/patient-search";

describe("patient-search helpers", () => {
  it("normalizes phone to digits only", () => {
    expect(normalizePhoneDigits("+63 917-123-4567")).toBe("639171234567");
  });

  it("detects digits-only terms", () => {
    expect(isDigitsOnly("42")).toBe(true);
    expect(isDigitsOnly("Jo")).toBe(false);
  });

  it("splits multi-word search terms", () => {
    expect(splitSearchTokens("  john   doe ")).toEqual(["john", "doe"]);
  });

  it("escapes PostgREST filter values", () => {
    expect(escapePostgrestValue('say "hello"')).toBe('say ""hello""');
  });

  it("builds ilike patterns", () => {
    expect(ilikePattern("ann")).toBe("%ann%");
  });

  it("enforces minimum search length", () => {
    expect(minSearchLength("a")).toBe(false);
    expect(minSearchLength("ab")).toBe(true);
    expect(minSearchLength("5")).toBe(true);
  });
});
