"use client";

import { useState } from "react";
import { createAssignmentFromParticipantDraft } from "../actions";

type Copy = {
  mode: string; pr: string; paid: string; prPaid: string; attendance: string; content: string;
  orderNumber: string; orderHelp: string; amount: string; amountHelp: string; branch: string; attendanceAt: string;
  social: string; contentType: string; requiresContent: string; notes: string; advanced: string; confirm: string; cancel: string;
};

type Social = { id: string; platform: string; username: string; followers_count: number | null };

export function SimplifiedAssignmentForm({ campaignId, draftId, socials, campaignDefaultAmount, copy }: { campaignId: string; draftId: string; socials: Social[]; campaignDefaultAmount: number | null; copy: Copy }) {
  const [mode, setMode] = useState("pr");
  const [requiresContent, setRequiresContent] = useState(true);
  const isPr = mode === "pr" || mode === "pr_paid";
  const isPaid = mode === "paid" || mode === "pr_paid";
  const isAttendance = mode === "attendance";

  return (
    <form action={createAssignmentFromParticipantDraft} className="space-y-5">
      <input type="hidden" name="campaign_id" value={campaignId}/>
      <input type="hidden" name="draft_id" value={draftId}/>
      <div>
        <label className="text-xs font-black text-[#705B7A]">{copy.mode}</label>
        <select name="mode" value={mode} onChange={(event) => { const value=event.target.value; setMode(value); if (value === "attendance") setRequiresContent(false); else setRequiresContent(true); }} className={input}>
          <option value="pr">{copy.pr}</option>
          <option value="paid">{copy.paid}</option>
          <option value="pr_paid">{copy.prPaid}</option>
          <option value="attendance">{copy.attendance}</option>
          <option value="content">{copy.content}</option>
        </select>
      </div>

      {isPr ? <div><label className="text-xs font-black text-[#705B7A]">{copy.orderNumber}</label><input name="order_number" required className={input}/><p className="mt-2 text-xs font-semibold leading-6 text-[#9A8FA0]">{copy.orderHelp}</p></div> : null}
      {isPaid ? <div><label className="text-xs font-black text-[#705B7A]">{copy.amount}</label><input name="amount" inputMode="decimal" placeholder={campaignDefaultAmount ? String(campaignDefaultAmount) : ""} className={input}/><p className="mt-2 text-xs font-semibold text-[#9A8FA0]">{copy.amountHelp}</p></div> : null}
      {isAttendance ? <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-black text-[#705B7A]">{copy.branch}</label><input name="branch_name" required className={input}/></div><div><label className="text-xs font-black text-[#705B7A]">{copy.attendanceAt}</label><input type="datetime-local" name="attendance_at" className={input}/></div></div> : null}

      <label className="flex items-center gap-3 rounded-2xl border border-[#E9DFF0] bg-[#FDFBFE] p-4 text-sm font-black text-[#5C456B]"><input type="checkbox" name="requires_content" checked={requiresContent} onChange={(event)=>setRequiresContent(event.target.checked)} className="h-5 w-5"/><span>{copy.requiresContent}</span></label>

      {requiresContent ? <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-black text-[#705B7A]">{copy.social}</label><select name="social_account_id" className={input} defaultValue={socials[0]?.id ?? ""}>{socials.map((social)=><option key={social.id} value={social.id}>{social.platform} · @{social.username}{social.followers_count ? ` · ${social.followers_count}` : ""}</option>)}</select></div><div><label className="text-xs font-black text-[#705B7A]">{copy.contentType}</label><input name="content_type" className={input}/></div></div> : null}

      <details className="rounded-2xl border border-[#E9DFF0] bg-[#FCFAFD] p-4"><summary className="cursor-pointer text-sm font-black text-[#6658A8]">{copy.advanced}</summary><div className="mt-4"><label className="text-xs font-black text-[#705B7A]">{copy.notes}</label><textarea name="notes" rows={4} className="mt-2 w-full rounded-2xl border border-[#E7DCEB] bg-white p-3 text-sm font-semibold outline-none focus:border-[#A775C0]"/></div></details>

      <button className="w-full rounded-2xl bg-gradient-to-br from-[#A775C0] to-[#6676C8] px-5 py-3.5 text-sm font-black text-white shadow-lg">{copy.confirm}</button>
    </form>
  );
}
const input = "mt-2 h-12 w-full rounded-2xl border border-[#E7DCEB] bg-white px-4 text-sm font-bold text-[#4C335F] outline-none focus:border-[#A775C0]";
