/**
 * Zod schema validation tests — no DB required.
 */
import { describe, it, expect } from "vitest";
import {
  BookAppointmentSchema,
  CancelAppointmentSchema,
  StaffUpdateAppointmentSchema,
} from "../lib/schemas/appointment";
import { CheckinBodySchema } from "../lib/schemas/checkin";
import { RegisterPatientSchema } from "../lib/schemas/patient";
import { QueueActionSchema } from "../lib/schemas/queue";
import { StaffActionSchema } from "../lib/schemas/admin";

describe("BookAppointmentSchema", () => {
  const base = {
    preferredDoctor: "550e8400-e29b-41d4-a716-446655440000",
    appointmentType: 1,
    appointmentDate: "2026-06-10",
    appointmentTime: "09:00",
    termsAgreement: true,
  };

  it("accepts booking with existing patient_id", () => {
    const result = BookAppointmentSchema.safeParse({
      ...base,
      patient_id: 42,
    });
    expect(result.success).toBe(true);
  });

  it("requires guest fields when patient_id is absent", () => {
    const result = BookAppointmentSchema.safeParse(base);
    expect(result.success).toBe(false);
  });

  it("accepts full guest booking", () => {
    const result = BookAppointmentSchema.safeParse({
      ...base,
      firstName: "Juan",
      lastName: "Dela Cruz",
      dob: "1990-01-15",
      gender: "male",
      address: "Manila",
      phone: "09171234567",
      consent: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("CancelAppointmentSchema", () => {
  it("requires action cancel with reference and phone", () => {
    expect(
      CancelAppointmentSchema.safeParse({
        action: "cancel",
        reference: "APT20260610001",
        phone: "09171234567",
      }).success
    ).toBe(true);
  });
});

describe("StaffUpdateAppointmentSchema", () => {
  it("accepts valid staff update", () => {
    expect(
      StaffUpdateAppointmentSchema.safeParse({
        action: "staff_update",
        checkinId: 1,
        status: "confirm",
      }).success
    ).toBe(true);
  });
});

describe("RegisterPatientSchema", () => {
  it("accepts valid registration", () => {
    expect(
      RegisterPatientSchema.safeParse({
        firstName: "Maria",
        lastName: "Santos",
        dob: "1985-03-20",
        gender: "female",
        phone: "09171234567",
        address: "Quezon City",
        consent: true,
      }).success
    ).toBe(true);
  });

  it("rejects invalid DOB format", () => {
    expect(
      RegisterPatientSchema.safeParse({
        firstName: "Maria",
        lastName: "Santos",
        dob: "03/20/1985",
        gender: "female",
        phone: "09171234567",
        address: "Quezon City",
        consent: true,
      }).success
    ).toBe(false);
  });
});

describe("CheckinBodySchema", () => {
  it("accepts appointment check-in", () => {
    expect(CheckinBodySchema.safeParse({ appointmentId: "APT20260610001" }).success).toBe(
      true
    );
  });

  it("accepts walk-in check-in", () => {
    expect(
      CheckinBodySchema.safeParse({
        type: "walk-in",
        patientId: 1,
        appointmentType: 2,
        additionalinfo: "Headache",
        termsAgreement: true,
      }).success
    ).toBe(true);
  });
});

describe("QueueActionSchema", () => {
  it("accepts call_next with required fields", () => {
    expect(
      QueueActionSchema.safeParse({
        action: "call_next",
        queueId: 5,
        doctorId: "550e8400-e29b-41d4-a716-446655440000",
        roomNumber: 1,
      }).success
    ).toBe(true);
  });

  it("accepts mark_no_show (legacy action name)", () => {
    expect(
      QueueActionSchema.safeParse({ action: "mark_no_show", queueId: 3 }).success
    ).toBe(true);
  });

  it("accepts get_report and get_analytics", () => {
    expect(QueueActionSchema.safeParse({ action: "get_report" }).success).toBe(true);
    expect(QueueActionSchema.safeParse({ action: "get_analytics" }).success).toBe(true);
  });
});

describe("StaffActionSchema", () => {
  it("accepts staff register", () => {
    expect(
      StaffActionSchema.safeParse({
        action: "register",
        firstName: "Ana",
        lastName: "Reyes",
        email: "ana@clinic.test",
        password: "securepass",
        role: "nurse",
      }).success
    ).toBe(true);
  });
});

describe("maskPatientName", () => {
  it("masks to initials format", async () => {
    const { maskPatientName } = await import("../lib/services/patient.service");
    expect(maskPatientName("Juan", "Dela Cruz")).toBe("J. D***");
  });
});
