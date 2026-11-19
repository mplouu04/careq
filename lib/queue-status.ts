export function isCalledLikeStatus(status: string | null | undefined): boolean {
  return status === "in_progress" || status === "called";
}

/** Lounge / pre-doctor stages (not yet in a consult room). */
export function isLoungeStatus(status: string | null | undefined): boolean {
  return (
    status === "waiting" ||
    status === "with_nurse" ||
    status === "ready_for_doctor"
  );
}

/** Eligible for doctor Call (prefer ready; waiting allowed as desk override). */
export function isCallableStatus(status: string | null | undefined): boolean {
  return status === "ready_for_doctor" || status === "waiting";
}

/**
 * A booked appointment (looked up by its APT reference) that has no queue entry yet:
 * either it is later than today, or it is today and the patient has not checked in.
 * Only active bookings count; cancelled / no-show / completed / rejected fall through.
 */
export function isUpcomingBookedCheckin(
  checkin: {
    status: string;
    approval_status?: string | null;
    appointment_date?: string | null;
  },
  todayYmd: string
): boolean {
  if (!checkin.appointment_date) return false;
  if (checkin.approval_status === "rejected") return false;
  if (checkin.status !== "pending" && checkin.status !== "checked_in") return false;
  return checkin.appointment_date.slice(0, 10) >= todayYmd;
}
