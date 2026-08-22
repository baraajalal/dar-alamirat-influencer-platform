"use client";

import { useState } from "react";

export function VoucherSelectAll({ eligibleCount }: { eligibleCount: number }) {
  const [checked, setChecked] = useState(false);

  function toggleAll(next: boolean) {
    setChecked(next);
    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[data-website-voucher-select="true"]:not(:disabled)',
    );
    for (const input of inputs) input.checked = next;
  }

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#DDE3F5] bg-white px-4 py-3 text-sm font-black text-[#75677B]">
      <input
        type="checkbox"
        checked={checked}
        disabled={eligibleCount === 0}
        onChange={(event) => toggleAll(event.target.checked)}
        className="h-5 w-5 accent-[#9362AD] disabled:opacity-40"
      />
      تحديد كل قسائم الموقع الظاهرة ({eligibleCount})
    </label>
  );
}
