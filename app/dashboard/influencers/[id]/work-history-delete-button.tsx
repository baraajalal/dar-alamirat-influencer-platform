"use client";

import { deleteWorkHistory } from "./work-history-actions";

export function WorkHistoryDeleteButton({ influencerId, historyId, label, confirmation }: { influencerId: string; historyId: string; label: string; confirmation: string }) {
  return (
    <form action={deleteWorkHistory} onSubmit={(event) => { if (!window.confirm(confirmation)) event.preventDefault(); }}>
      <input type="hidden" name="influencer_id" value={influencerId} />
      <input type="hidden" name="history_id" value={historyId} />
      <button className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700">{label}</button>
    </form>
  );
}
