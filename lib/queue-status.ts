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
