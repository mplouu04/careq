"use client";

import { Phone } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CareqButton } from "@/components/careq";
import { cn } from "@/lib/utils";

type Doctor = { id: string; first_name: string; last_name: string };
type Room = { id: string; name: string };

type QueueCommandBarProps = {
  doctors: Doctor[];
  rooms: Room[];
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
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Select value={doctorId} onValueChange={(v) => onDoctorChange(v ?? "")}>
          <SelectTrigger
            className="h-11 min-w-[140px] flex-1 sm:flex-none sm:max-w-[200px] cursor-pointer"
            aria-label="Doctor"
          >
            <SelectValue placeholder="Doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.first_name} {d.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={roomId} onValueChange={(v) => onRoomChange(v ?? "")}>
          <SelectTrigger
            className="h-11 min-w-[120px] flex-1 sm:flex-none sm:max-w-[160px] cursor-pointer"
            aria-label="Room"
          >
            <SelectValue placeholder="Room" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <CareqButton
          type="button"
          className="min-h-[44px] gap-2 shrink-0 cursor-pointer"
          disabled={!canCall}
          onClick={onCallNext}
          title={hint}
          aria-disabled={!canCall}
        >
          <Phone className="h-4 w-4" aria-hidden />
          Call next
        </CareqButton>

        <div className="flex items-center gap-1.5 ml-auto text-body-sm text-on-surface-variant">
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              isLive ? "bg-status-called motion-safe:animate-pulse" : "bg-amber-500"
            )}
            aria-hidden
          />
          <span>Live</span>
        </div>
      </div>
    </div>
  );
}
