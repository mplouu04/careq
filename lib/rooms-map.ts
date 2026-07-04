import type { SupabaseClient } from "@supabase/supabase-js";

const ROOMS_CACHE_TTL_MS = 30_000;

type RoomsCacheEntry = { map: Map<number, string>; expiresAt: number };
let roomsCache: RoomsCacheEntry | null = null;

export async function getRoomNameMap(
  supabase: SupabaseClient
): Promise<Map<number, string>> {
  if (roomsCache && roomsCache.expiresAt > Date.now()) {
    return roomsCache.map;
  }

  try {
    const { data } = await supabase.from("rooms").select("id, name").eq("is_active", true);
    const map = new Map<number, string>();
    for (const r of data ?? []) {
      map.set(r.id, r.name);
    }
    roomsCache = { map, expiresAt: Date.now() + ROOMS_CACHE_TTL_MS };
    return map;
  } catch {
    return roomsCache?.map ?? new Map();
  }
}

export function resolveRoomName(
  roomId: number | null | undefined,
  roomMap: Map<number, string>
): string {
  if (roomId == null) return "";
  return roomMap.get(Number(roomId)) ?? `Room ${roomId}`;
}
