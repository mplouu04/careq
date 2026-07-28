/**
 * Shared constants for the doctors Realtime Broadcast channel. Kept in a
 * separate module so the client (booking page, staff dashboard) can import
 * the topic/event names without pulling in the server-only HTTP sender.
 */
export const DOCTORS_BROADCAST_TOPIC = "doctors:changes";
export const DOCTORS_BROADCAST_EVENT = "changed";
