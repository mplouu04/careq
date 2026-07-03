"use client";

import { useMemo } from "react";
import { Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CareqButton, FormLabel } from "@/components/careq";
import {
  doctorLabel,
  doctorSelectItems,
  roomLabel,
  roomSelectItems,
  type DoctorOption,
  type RoomOption,
} from "@/lib/staff-select-labels";
import { cn } from "@/lib/utils";

type QueueCommandBarProps = {
  doctors: DoctorOption[];
  rooms: RoomOption[];
  doctorId: string;
  roomId: string;
  onDoctorChange: (id: string) => void;
  onRoomChange: (id: string) => void;
  onCallNext: () => void;
  canCall: boolean;
  isLive?: boolean;
  className?: string;
};

export function QueueCommandBar({
  doctors,
  rooms,
  doctorId,
  roomId,
  onDoctorChange,
  onRoomChange,
  onCallNext,
  canCall,
  isLive = true,
  className,
}: QueueCommandBarProps) {
  const doctorItems = useMemo(() => doctorSelectItems(doctors), [doctors]);
  const roomItems = useMemo(() => roomSelectItems(rooms), [rooms]);

  const hint = !canCall
    ? !doctorId && !roomId
      ? "Select doctor and room"
      : !doctorId
        ? "Select doctor"
        : !roomId
          ? "Select room"
          : "No patients waiting"
    : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 md:px-4 md:py-3",
        className
      )}
    >
      <div className="flex flex-wrap items-end gap-2 md:gap-3">
        <div className="flex flex-col flex-1 sm:flex-none min-w-[140px] sm:max-w-[200px]">
          <FormLabel htmlFor="queue-doctor-select">Doctor</FormLabel>
          <Select
            value={doctorId || null}
            onValueChange={(v) => onDoctorChange(v ?? "")}
            items={doctorItems}
          >
            <SelectTrigger
              id="queue-doctor-select"
              className="h-11 w-full cursor-pointer"
              aria-label="Doctor"
            >
              <SelectValue placeholder="Doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {doctorLabel(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col flex-1 sm:flex-none min-w-[120px] sm:max-w-[160px]">
          <FormLabel htmlFor="queue-room-select">Room</FormLabel>
          <Select
            value={roomId || null}
            onValueChange={(v) => onRoomChange(v ?? "")}
            items={roomItems}
          >
            <SelectTrigger
              id="queue-room-select"
              className="h-11 w-full cursor-pointer"
              aria-label="Room"
            >
              <SelectValue placeholder="Room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {roomLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <CareqButton
          type="button"
          className={cn(
            "min-h-[44px] gap-2 shrink-0 cursor-pointer transition-opacity",
            !canCall && "opacity-50"
          )}
          disabled={!canCall}
          onClick={onCallNext}
          title={hint}
          aria-disabled={!canCall}
        >
          <Phone className="h-4 w-4" aria-hidden />
          Call next
        </CareqButton>

        <div
          className="flex items-center gap-1.5 ml-auto pb-2.5 text-body-sm text-on-surface-variant"
          title={isLive ? "Connected" : "Reconnecting"}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              isLive
                ? "bg-emerald-500 motion-safe:animate-pulse motion-reduce:animate-none"
                : "bg-amber-500"
            )}
            aria-hidden
          />
          <span>{isLive ? "Live" : "Offline"}</span>
        </div>
      </div>
    </div>
  );
}
