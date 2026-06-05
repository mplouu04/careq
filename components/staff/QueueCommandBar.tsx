"use client";

import { UserPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CareqButton, FormLabel } from "@/components/careq";
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
  nextPatientLabel?: string;
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
  nextPatientLabel,
  className,
}: QueueCommandBarProps) {
  const missingDoctor = !doctorId;
  const missingRoom = !roomId;
  const hint =
    missingDoctor && missingRoom
      ? "Select a doctor and room to call the next patient"
      : missingDoctor
        ? "Select a doctor"
        : missingRoom
          ? "Select a room"
          : !nextPatientLabel
            ? "No patients waiting"
            : undefined;

  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-5",
        className
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          <div>
            <FormLabel>Doctor</FormLabel>
            <Select value={doctorId} onValueChange={(v) => onDoctorChange(v ?? "")}>
              <SelectTrigger className="w-full h-11 mt-1">
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FormLabel>Room</FormLabel>
            <Select value={roomId} onValueChange={(v) => onRoomChange(v ?? "")}>
              <SelectTrigger className="w-full h-11 mt-1">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:min-w-[200px]">
          <CareqButton
            type="button"
            className="w-full min-h-[44px] gap-2"
            disabled={!canCall}
            onClick={onCallNext}
            title={hint}
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Call next patient
          </CareqButton>
          {nextPatientLabel && (
            <p className="text-label-sm text-on-surface-variant text-center lg:text-left">
              Next: <span className="font-mono text-primary">{nextPatientLabel}</span>
            </p>
          )}
          {hint && !canCall && (
            <p className="text-label-sm text-amber-700 text-center lg:text-left" role="status">
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
