import { CAREQ_PRIMARY } from "@/lib/design-tokens";

export type BookingDoctor = {
  id: string;
  name: string;
  spec: string;
  initials: string;
  avatarColor: string;
  slots: string[];
  takenSlots: string[];
  unavailableDays: number[];
};

export const BOOKING_DOCTORS: BookingDoctor[] = [
  {
    id: "dr-chen",
    name: "Dr. Sarah Chen",
    spec: "General Practice",
    initials: "SC",
    avatarColor: CAREQ_PRIMARY,
    slots: [
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
    ],
    takenSlots: ["09:30", "11:00", "14:30"],
    unavailableDays: [0, 6],
  },
  {
    id: "dr-patel",
    name: "Dr. Raj Patel",
    spec: "Internal Medicine",
    initials: "RP",
    avatarColor: "#1a5fb4",
    slots: [
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
    ],
    takenSlots: ["09:00", "10:30", "14:00"],
    unavailableDays: [0, 6],
  },
  {
    id: "dr-williams",
    name: "Dr. Emma Williams",
    spec: "Family Medicine",
    initials: "EW",
    avatarColor: "#003d99",
    slots: [
      "09:00",
      "09:45",
      "10:30",
      "11:15",
      "13:00",
      "13:45",
      "14:30",
      "15:15",
      "16:00",
    ],
    takenSlots: ["10:30", "13:45"],
    unavailableDays: [0, 6],
  },
  {
    id: "dr-kim",
    name: "Dr. James Kim",
    spec: "Pediatrics",
    initials: "JK",
    avatarColor: "#2563c4",
    slots: [
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "15:00",
      "15:30",
      "16:00",
    ],
    takenSlots: ["08:30", "09:30", "15:00"],
    unavailableDays: [0, 6],
  },
];

export const BOOKING_REASONS = [
  "General checkup",
  "Follow-up",
  "Lab results",
  "Vaccination",
  "Prescription refill",
  "Referral",
  "Other",
] as const;

export function generateBookingReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CQ-${code}`;
}
