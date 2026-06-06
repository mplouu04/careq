/** Admin panel design tokens — matches screenshot spec */

export const ADMIN_COLORS = {
  primary: "#2563EB",
  primaryLight: "#EFF6FF",
  danger: "#DC2626",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textCell: "#374151",
  border: "#E5E7EB",
  borderInput: "#D1D5DB",
  pageBg: "#F3F4F6",
  cardBg: "#ffffff",
  badgeGreenBg: "#F0FDF4",
  badgeGreenText: "#16A34A",
  badgeBlueBg: "#EFF6FF",
  badgeBlueText: "#2563EB",
  dangerBorder: "#FEE2E2",
  dangerBg: "#FFF5F5",
  rowHover: "#FAFAFA",
  rowDivider: "#F9FAFB",
} as const;

export const ADMIN_TABS = [
  { value: "staff", label: "Staff" },
  { value: "types", label: "Appointment Types" },
  { value: "display", label: "Display Screens" },
  { value: "appointments", label: "Appointments" },
  { value: "rooms", label: "Rooms" },
  { value: "hours", label: "Clinic Hours" },
  { value: "data", label: "Data", danger: true },
] as const;
