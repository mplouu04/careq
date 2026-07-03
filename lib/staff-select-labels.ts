export type DoctorOption = { id: string; first_name: string; last_name: string };
export type RoomOption = { id: string; name: string };

export function doctorLabel(d: DoctorOption): string {
  return `Dr. ${d.first_name} ${d.last_name}`;
}

export function roomLabel(r: RoomOption): string {
  return r.name;
}

export function doctorSelectItems(doctors: DoctorOption[]) {
  return doctors.map((d) => ({ value: d.id, label: doctorLabel(d) }));
}

export function roomSelectItems(rooms: RoomOption[]) {
  return rooms.map((r) => ({ value: r.id, label: roomLabel(r) }));
}

export function doctorLabelForValue(
  doctors: DoctorOption[],
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const d = doctors.find((doc) => doc.id === value);
  return d ? doctorLabel(d) : null;
}

export function roomLabelForValue(
  rooms: RoomOption[],
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const r = rooms.find((room) => room.id === value);
  return r ? roomLabel(r) : null;
}
