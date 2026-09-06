"use client";

import { useState } from "react";
import { CareqButton } from "@/components/careq/careq-button";
import { FormHelperText, FormInput, FormLabel } from "@/components/careq/form-primitives";
import { cn } from "@/lib/utils";

type EmailVerifyFieldProps = {
  email: string;
  onEmailChange: (value: string) => void;
  emailProofToken: string | null;
  onProofChange: (token: string | null) => void;
  emailError?: string;
  onClearEmailError?: () => void;
  idPrefix?: string;
};

export function EmailVerifyField({
  email,
  onEmailChange,
  emailProofToken,
  onProofChange,
  emailError,
  onClearEmailError,
  idPrefix = "email",
}: EmailVerifyFieldProps) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const verified = Boolean(emailProofToken);
  const emailId = idPrefix;
  const codeId = `${idPrefix}-code`;

  async function sendCode() {
    setLocalError(null);
    setInfo(null);
    setSending(true);
    try {
      const res = await fetch("/api/email-verify/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalError((data as { error?: string }).error ?? "Failed to send code");
        return;
      }
      setSent(true);
      setInfo("We sent a code to your email.");
      onProofChange(null);
      setCode("");
    } catch {
      setLocalError("Failed to send code. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function confirmCode() {
    setLocalError(null);
    setInfo(null);
    setConfirming(true);
    try {
      const res = await fetch("/api/email-verify/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLocalError((data as { error?: string }).error ?? "Invalid or expired code");
        onProofChange(null);
        return;
      }
      const token = (data as { emailProofToken?: string }).emailProofToken;
      if (!token) {
        setLocalError("Verification failed. Please try again.");
        return;
      }
      onProofChange(token);
      setInfo("Email verified.");
    } catch {
      setLocalError("Verification failed. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <FormLabel htmlFor={emailId} required>
          Email
        </FormLabel>
        <div className="flex flex-col sm:flex-row gap-2">
          <FormInput
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => {
              onClearEmailError?.();
              setLocalError(null);
              setInfo(null);
              setSent(false);
              onProofChange(null);
              onEmailChange(e.target.value);
            }}
            aria-invalid={!!emailError}
            aria-describedby={
              emailError ? `${emailId}-error` : `${emailId}-hint`
            }
            className={cn("flex-1", emailError && "border-destructive")}
            autoComplete="email"
            disabled={verified}
          />
          <CareqButton
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={sending || verified || !email.trim()}
            onClick={() => void sendCode()}
          >
            {sending ? "Sending…" : sent && !verified ? "Resend code" : "Send code"}
          </CareqButton>
        </div>
        {emailError ? (
          <FormHelperText id={`${emailId}-error`} className="text-destructive">
            {emailError}
          </FormHelperText>
        ) : (
          <FormHelperText id={`${emailId}-hint`}>
            Required for appointment reminders
          </FormHelperText>
        )}
      </div>

      {(sent || verified) && (
        <div>
          <FormLabel htmlFor={codeId} required>
            Verification code
          </FormLabel>
          <div className="flex flex-col sm:flex-row gap-2">
            <FormInput
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="6-digit code"
              value={code}
              onChange={(e) => {
                setLocalError(null);
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              }}
              disabled={verified}
              className="flex-1 font-mono tracking-widest"
            />
            <CareqButton
              type="button"
              className="shrink-0"
              disabled={confirming || verified || code.length !== 6}
              onClick={() => void confirmCode()}
            >
              {verified ? "Verified" : confirming ? "Verifying…" : "Verify"}
            </CareqButton>
          </div>
        </div>
      )}

      {localError && (
        <FormHelperText className="text-destructive">{localError}</FormHelperText>
      )}
      {info && !localError && (
        <FormHelperText className="text-primary">{info}</FormHelperText>
      )}
    </div>
  );
}
