import { describe, it, expect } from "vitest";
import { normalizeQueueRef } from "../lib/queue-ref";

describe("normalizeQueueRef", () => {
  it("uppercases and preserves hyphenated refs", () => {
    expect(normalizeQueueRef("walk-5")).toBe("WALK-5");
  });

  it("inserts hyphen for compact walk refs", () => {
    expect(normalizeQueueRef("walk5")).toBe("WALK-5");
    expect(normalizeQueueRef("WALK12")).toBe("WALK-12");
  });

  it("inserts hyphen for appointment refs", () => {
    expect(normalizeQueueRef("appt3")).toBe("APPT-3");
  });

  it("trims whitespace", () => {
    expect(normalizeQueueRef("  walk-1  ")).toBe("WALK-1");
  });
});
