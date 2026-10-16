import { describe, expect, it } from "vitest";
import { contrastRatio, themeColorMeetsAa, meetsWcagAa } from "../lib/contrast";
import {
  filterRoomsByIds,
  parseRoomsQueryParam,
  resolveRoomFilter,
} from "../lib/display-rooms";
import {
  formatRoomName,
  roomLabelForPrefixedUi,
  roomNameWithoutPrefix,
} from "../lib/room-label";
import { clampGraceMinutes } from "../lib/clinic-settings";
import { CAREQ_PRIMARY } from "../lib/design-tokens";

describe("contrast helpers", () => {
  it("computes contrast for white on primary", () => {
    const ratio = contrastRatio("#ffffff", CAREQ_PRIMARY);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeGreaterThanOrEqual(4.5);
    expect(themeColorMeetsAa(CAREQ_PRIMARY)).toBe(true);
  });

  it("rejects light theme colors against white text", () => {
    expect(themeColorMeetsAa("#ffffff")).toBe(false);
    expect(themeColorMeetsAa("#eeeeee")).toBe(false);
    expect(meetsWcagAa("#ffffff", "#ffff00", false)).toBe(false);
  });
});

describe("display room filter", () => {
  it("parses comma lists and ranges", () => {
    expect(parseRoomsQueryParam("1,2,3")).toEqual([1, 2, 3]);
    expect(parseRoomsQueryParam("1-5")).toEqual([1, 2, 3, 4, 5]);
    expect(parseRoomsQueryParam("6-10")).toEqual([6, 7, 8, 9, 10]);
  });

  it("prefers URL rooms over screen room_ids", () => {
    expect(
      resolveRoomFilter({ urlRooms: [1, 2], screenRoomIds: [9, 10] })
    ).toEqual([1, 2]);
    expect(resolveRoomFilter({ urlRooms: null, screenRoomIds: [3] })).toEqual([3]);
    expect(resolveRoomFilter({ urlRooms: null, screenRoomIds: null })).toBeNull();
  });

  it("filters room panels by id", () => {
    const rooms = [
      { id: 1, name: "Room 1" },
      { id: 2, name: "Room 2" },
      { id: 3, name: "Room 3" },
    ];
    expect(filterRoomsByIds(rooms, [1, 3]).map((r) => r.id)).toEqual([1, 3]);
    expect(filterRoomsByIds(rooms, null)).toEqual(rooms);
  });
});

describe("room labels", () => {
  it("strips Room prefix for table cells", () => {
    expect(roomNameWithoutPrefix("Room 3")).toBe("3");
    expect(roomLabelForPrefixedUi("Room 3", "Room")).toBe("3");
    expect(formatRoomName("Room 3")).toBe("Room 3");
  });
});

describe("grace minutes", () => {
  it("clamps to 1–60 with default 5", () => {
    expect(clampGraceMinutes(5)).toBe(5);
    expect(clampGraceMinutes(0)).toBe(1);
    expect(clampGraceMinutes(99)).toBe(60);
    expect(clampGraceMinutes(Number.NaN)).toBe(5);
  });
});
