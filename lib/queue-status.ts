export function isCalledLikeStatus(status: string | null | undefined): boolean {
  return status === "in_progress" || status === "called";
}
