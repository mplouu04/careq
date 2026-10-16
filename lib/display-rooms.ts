/** Parse and apply per-screen / URL room filters for the public queue board. */

export function parseRoomsQueryParam(raw: string | null): number[] | null {
  if (raw == null || !raw.trim()) return null;
  // Split on commas/spaces/underscores only — keep hyphen ranges like "1-5"
  const parts = raw.split(/[,\s_]+/).map((p) => p.trim()).filter(Boolean);
  const ids: number[] = [];
  for (const part of parts) {
    // Support ranges like "1-5"
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) ids.push(i);
      continue;
    }
    const n = parseInt(part, 10);
    if (Number.isFinite(n) && n > 0) ids.push(n);
  }
  return ids.length ? Array.from(new Set(ids)) : null;
}

/** URL override wins; else DB room_ids; null/empty means all rooms. */
export function resolveRoomFilter(opts: {
  urlRooms: number[] | null;
  screenRoomIds: number[] | null | undefined;
}): number[] | null {
  if (opts.urlRooms?.length) return opts.urlRooms;
  if (opts.screenRoomIds?.length) return opts.screenRoomIds;
  return null;
}

export function filterRoomsByIds<T extends { id: number }>(
  rooms: T[],
  filter: number[] | null
): T[] {
  if (!filter?.length) return rooms;
  const allowed = new Set(filter);
  return rooms.filter((r) => allowed.has(r.id));
}
