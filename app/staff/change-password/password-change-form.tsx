"use client";

import { FormEvent, useMemo, useState } from "react";
import { changeForcedStaffPassword } from "./actions";

export type StaffPasswordCopy = {
  newPassword: string;
  confirmPassword: string;
  showPassword: string;
  hidePassword: string;
  requirementLength: string;
  requirementLetter: string;
  requirementNumber: string;
  mismatch: string;
  saveAndContinue: string;
  saving: string;
};

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      {!open ? (
        <path d="m4 4 16 16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
      ) : null}
    </svg>
  );
}

export default function PasswordChangeForm({ copy }: { copy: StaffPasswordCopy }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientError, setClientError] = useState("");

  const rules = useMemo(
    () => ({
      length: password.length >= 10,
      letter: /\p{L}/u.test(password),
      number: /[0-9]/.test(password),
    }),
    [password],
  );

  const valid = rules.length && rules.letter && rules.number;
  const matches = confirmation.length > 0 && password === confirmation;

  function validate(event: FormEvent<HTMLFormElement>) {
    setClientError("");

    if (!valid || password !== confirmation) {
      event.preventDefault();
      setClientError(password !== confirmation ? copy.mismatch : "");
      return;
    }

    setSubmitting(true);
  }

  const ruleClass = (ok: boolean) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition ${
      ok ? "bg-emerald-50 text-emerald-700" : "bg-[#F7F2F9] text-[#7E6A87]"
    }`;

  return (
    <form action={changeForcedStaffPassword} onSubmit={validate} className="mt-7 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-black text-[#5A3473]">{copy.newPassword}</span>
        <div className="relative">
          <input
            name="new_password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type={showPassword ? "text" : "password"}
            required
            minLength={10}
            autoComplete="new-password"
            dir="ltr"
            className="h-14 w-full rounded-2xl border border-[#E6D7EC] bg-[#FEFCFF] px-4 pe-12 text-[16px] font-bold text-[#432A57] outline-none transition focus:border-[#9566AF] focus:ring-4 focus:ring-[#9566AF]/10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#876E91] transition hover:bg-[#F3E9F7]"
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            title={showPassword ? copy.hidePassword : copy.showPassword}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
      </label>

      <label className="block">
        <span className="mb-2 block text-sm font-black text-[#5A3473]">{copy.confirmPassword}</span>
        <div className="relative">
          <input
            name="confirm_password"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            type={showConfirmation ? "text" : "password"}
            required
            minLength={10}
            autoComplete="new-password"
            dir="ltr"
            className="h-14 w-full rounded-2xl border border-[#E6D7EC] bg-[#FEFCFF] px-4 pe-12 text-[16px] font-bold text-[#432A57] outline-none transition focus:border-[#9566AF] focus:ring-4 focus:ring-[#9566AF]/10"
          />
          <button
            type="button"
            onClick={() => setShowConfirmation((value) => !value)}
            className="absolute end-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#876E91] transition hover:bg-[#F3E9F7]"
            aria-label={showConfirmation ? copy.hidePassword : copy.showPassword}
            title={showConfirmation ? copy.hidePassword : copy.showPassword}
          >
            <EyeIcon open={showConfirmation} />
          </button>
        </div>
      </label>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className={ruleClass(rules.length)}><span aria-hidden="true">{rules.length ? "✓" : "○"}</span>{copy.requirementLength}</div>
        <div className={ruleClass(rules.letter)}><span aria-hidden="true">{rules.letter ? "✓" : "○"}</span>{copy.requirementLetter}</div>
        <div className={ruleClass(rules.number)}><span aria-hidden="true">{rules.number ? "✓" : "○"}</span>{copy.requirementNumber}</div>
      </div>

      {confirmation.length > 0 && !matches ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {copy.mismatch}
        </p>
      ) : null}

      {clientError ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {clientError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!valid || !matches || submitting}
        className="h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#AD79C5,#754A93)] text-base font-black text-white shadow-[0_16px_32px_rgba(117,74,147,0.24)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
      >
        {submitting ? copy.saving : copy.saveAndContinue}
      </button>
    </form>
  );
}
