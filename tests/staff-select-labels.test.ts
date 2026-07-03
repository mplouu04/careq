import { describe, it, expect } from "vitest";
import {
  doctorLabel,
  doctorLabelForValue,
  doctorSelectItems,
  roomLabel,
  roomLabelForValue,
  roomSelectItems,
} from "../lib/staff-select-labels";

describe("staff-select-labels", () => {
  const doctor = {
    id: "80666327-efd1-44a9-a488-0192b5f70640",
    first_name: "Ana",
    last_name: "Reyes",
  };

  const room = { id: "3", name: "Room A" };

  it("formats doctor label", () => {
    expect(doctorLabel(doctor)).toBe("Dr. Ana Reyes");
  });

  it("builds doctor select items with value and label", () => {
    expect(doctorSelectItems([doctor])).toEqual([
      {
        value: doctor.id,
        label: "Dr. Ana Reyes",
      },
    ]);
  });

  it("resolves doctor label from selected value", () => {
    expect(doctorLabelForValue([doctor], doctor.id)).toBe("Dr. Ana Reyes");
    expect(doctorLabelForValue([doctor], "missing-id")).toBeNull();
  });

  it("formats room label and select items", () => {
    expect(roomLabel(room)).toBe("Room A");
    expect(roomSelectItems([room])).toEqual([{ value: "3", label: "Room A" }]);
    expect(roomLabelForValue([room], "3")).toBe("Room A");
  });
});
