"use client";

import { useMemo, useState } from "react";
import { setTemporaryStaffPassword } from "@/app/dashboard/users/actions";

function makeTemporaryPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;

  const randomIndex = (length: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % length;
  };
  const pick = (chars: string) => chars[randomIndex(chars.length)];
  const value = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (value.length < 12) value.push(pick(all));

  for (let i = value.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [value[i], value[j]] = [value[j], value[i]];
  }
  return value.join("");
}

export default function StaffTempPasswordForm({
  userId,
  disabled = false,
}: {
  userId: string;
  disabled?: boolean;
}) {
  const initial = useMemo(() => "", []);
  const [password, setPassword] = useState(initial);
  const [copied, setCopied] = useState(false);

  async function copyPassword() {
    if (!password) return;
    await navigator.clipboard.writeText(password);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <form action={setTemporaryStaffPassword} className="flex min-w-[330px] flex-wrap items-center gap-2">
      <input type="hidden" name="user_id" value={userId} />
      <input
        name="temporary_password"
        type="text"
        dir="ltr"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        minLength={8}
        required
        disabled={disabled}
        autoComplete="off"
        placeholder="كلمة مرور مؤقتة"
        className="h-10 w-44 rounded-xl border border-[#E6D7EC] bg-[#FEFCFF] px-3 text-xs font-bold text-[#432A57] outline-none transition focus:border-[#9566AF] focus:ring-4 focus:ring-[#9566AF]/10 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => setPassword(makeTemporaryPassword())}
        className="h-10 rounded-xl bg-[#F3E9F7] px-3 text-xs font-black text-[#754A93] transition hover:bg-[#EAD9F0] disabled:cursor-not-allowed disabled:opacity-50"
      >
        توليد
      </button>
      <button
        type="button"
        disabled={disabled || !password}
        onClick={copyPassword}
        className="h-10 rounded-xl border border-[#E6D7EC] bg-white px-3 text-xs font-black text-[#754A93] transition hover:bg-[#FBF7FD] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {copied ? "تم النسخ" : "نسخ"}
      </button>
      <button
        type="submit"
        disabled={disabled || password.length < 8}
        className="h-10 rounded-xl bg-[linear-gradient(135deg,#AD79C5,#754A93)] px-3 text-xs font-black text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        تفعيل كلمة مؤقتة
      </button>
    </form>
  );
}
