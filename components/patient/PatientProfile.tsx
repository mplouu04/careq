"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  CareqButton,
  CareqCard,
  FormInput,
  FormLabel,
} from "@/components/careq";
import { patientProfileApi } from "@/lib/api/client";

function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDobInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

type Profile = {
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
  email: string;
  address: string;
  gender: string;
};

export function PatientProfile() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [active, setActive] = useState<{ phone: string; dob: string } | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const profileQuery = useQuery({
    queryKey: ["patient-profile", active?.phone, active?.dob],
    queryFn: async () => {
      if (!active) return null;
      const data = await patientProfileApi.lookup(active.phone, active.dob);
      const p = data.profile as Profile | null;
      if (!p) throw new Error("No profile found for these details.");
      return p;
    },
    enabled: Boolean(active),
  });

  const profile = profileQuery.data;

  const patchMutation = useMutation({
    mutationFn: async () => {
      if (!active) return;
      await patientProfileApi.patch({
        phone: active.phone,
        dob: active.dob,
        email: editEmail || undefined,
        address: editAddress || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      void queryClient.invalidateQueries({
        queryKey: ["patient-profile", active?.phone, active?.dob],
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Update failed"),
  });

  function lookup() {
    const isoDob = parseDobInput(dob);
    if (!phone.trim() || !isoDob) {
      toast.error("Enter phone and date of birth.");
      return;
    }
    setActive({ phone: phone.trim(), dob: isoDob });
  }

  return (
    <div className="space-y-5 max-w-xl">
      <CareqCard className="p-6 space-y-4">
        <h3 className="text-headline-sm text-on-surface">Verify identity</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormLabel htmlFor="profile-phone">Phone</FormLabel>
            <FormInput
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
            />
          </div>
          <div>
            <FormLabel htmlFor="profile-dob">Date of birth</FormLabel>
            <div className="relative">
              <FormInput
                id="profile-dob"
                value={dob}
                onChange={(e) => setDob(formatDobInput(e.target.value))}
                placeholder="dd/mm/yyyy"
                maxLength={10}
                className="pr-10"
              />
              <Calendar
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                aria-hidden
              />
            </div>
          </div>
        </div>
        <CareqButton onClick={lookup} disabled={profileQuery.isFetching} className="w-full">
          <UserRound className="h-4 w-4" />
          {profileQuery.isFetching ? "Loading..." : "View profile"}
        </CareqButton>
      </CareqCard>

      {profileQuery.isError && (
        <p className="text-body-sm text-destructive">Profile not found.</p>
      )}

      {profile && (
        <CareqCard className="p-6 space-y-4">
          <p className="text-headline-sm">
            {profile.firstName} {profile.lastName}
          </p>
          <dl className="grid gap-2 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Phone</dt>
              <dd>{profile.phone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Date of birth</dt>
              <dd>{profile.dob}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Gender</dt>
              <dd className="capitalize">{profile.gender || "—"}</dd>
            </div>
          </dl>
          <div>
            <FormLabel htmlFor="profile-email">Email</FormLabel>
            <FormInput
              id="profile-email"
              type="email"
              value={editEmail || profile.email}
              onChange={(e) => setEditEmail(e.target.value)}
            />
          </div>
          <div>
            <FormLabel htmlFor="profile-address">Address</FormLabel>
            <FormInput
              id="profile-address"
              value={editAddress || profile.address}
              onChange={(e) => setEditAddress(e.target.value)}
            />
          </div>
          <CareqButton
            onClick={() => patchMutation.mutate()}
            disabled={patchMutation.isPending}
            className="w-full"
          >
            Save changes
          </CareqButton>
        </CareqCard>
      )}
    </div>
  );
}