import { saveCampaignApplicationEvaluation, saveCampaignQualificationSettings } from "../actions";

type Locale = "ar" | "en";
type EvaluationStatus = "qualified" | "needs_review" | "waitlist" | "not_qualified";

export type CampaignQualificationSettings = {
  target_cities?: string[];
  target_platforms?: string[];
  min_followers?: number | null;
  min_average_views?: number | null;
  min_engagement_rate?: number | null;
  prefer_previous_brand_experience?: boolean;
};

export type CampaignApplicationQualificationSummary = {
  setup_exists?: boolean;
  evaluation_exists?: boolean;
  scoring_version?: string;
  total_score?: number;
  suggested_status?: EvaluationStatus;
  final_status?: EvaluationStatus | null;
  final_reason?: string | null;
  campaign_fit_rating?: number | null;
  campaign_fit_notes?: string | null;
  staff_notes?: string | null;
  evaluated_at?: string | null;
  evaluator_name?: string | null;
  general_evaluation?: {
    exists?: boolean;
    total_score?: number;
    suggested_status?: EvaluationStatus | null;
    final_status?: EvaluationStatus | null;
  };
  metrics?: {
    city?: string | null;
    platforms?: string[];
    total_followers?: number;
    average_views?: number;
    average_engagement?: number;
    same_brand_history_count?: number;
    same_brand_positive_count?: number;
  };
  criteria?: {
    city_match?: boolean | null;
    platform_match?: boolean | null;
    followers_match?: boolean | null;
    views_match?: boolean | null;
    engagement_match?: boolean | null;
    brand_history_match?: boolean | null;
  };
  settings?: CampaignQualificationSettings;
  score_breakdown?: Record<string, number>;
};

const AR = {
  settingsTitle: "معايير التأهيل لهذه الحملة",
  settingsDescription: "حدد فقط المعايير الخاصة بهذه الحملة. إذا تركت معيارًا فارغًا فلن يعاقب المؤثر عليه.",
  targetCities: "المدن المستهدفة",
  targetPlatforms: "المنصات المستهدفة",
  listHint: "افصل بين القيم بفاصلة أو سطر جديد",
  minFollowers: "الحد الأدنى للمتابعين",
  minViews: "الحد الأدنى لمتوسط المشاهدات",
  minEngagement: "الحد الأدنى للتفاعل %",
  preferBrandHistory: "احتساب خبرة سابقة مع نفس البراند كعامل تفضيل",
  saveSettings: "حفظ معايير التأهيل",
  score: "تقييم الحملة",
  systemSuggestion: "اقتراح النظام",
  staffDecision: "قرار الفريق للحملة",
  generalScore: "التقييم العام",
  campaignFit: "ملاءمة المؤثر للحملة",
  campaignFitNote: "ملاحظة الملاءمة",
  staffNotes: "ملاحظات الفريق",
  reason: "سبب القرار",
  noDecision: "لم يحدد بعد",
  chooseRating: "اختر التقييم",
  saveEvaluation: "حفظ تقييم الحملة",
  city: "المدينة",
  platform: "المنصة",
  followers: "المتابعون",
  views: "المشاهدات",
  engagement: "التفاعل",
  brandHistory: "خبرة نفس البراند",
  match: "مطابق",
  noMatch: "غير مطابق",
  notRequired: "غير مطلوب",
  previousWorks: "أعمال سابقة مع البراند",
  setupMissing: "طبّق قاعدة بيانات Phase 08.2 أولًا لعرض تقييم الحملة.",
  statuses: { qualified: "مؤهل", needs_review: "يحتاج مراجعة", waitlist: "قائمة انتظار", not_qualified: "غير مؤهل" },
  ratings: ["", "ضعيف", "مقبول", "جيد", "جيد جدًا", "ممتاز"],
  breakdown: {
    general_evaluation: "التقييم العام",
    campaign_fit: "ملاءمة الحملة",
    same_brand_history: "خبرة البراند",
    city: "المدينة",
    platform: "المنصة",
    followers: "المتابعون",
    average_views: "المشاهدات",
    engagement: "التفاعل",
  },
};

const EN = {
  settingsTitle: "Campaign qualification criteria",
  settingsDescription: "Set only the criteria that matter for this campaign. Blank criteria do not penalize the creator.",
  targetCities: "Target cities",
  targetPlatforms: "Target platforms",
  listHint: "Separate values with commas or new lines",
  minFollowers: "Minimum followers",
  minViews: "Minimum average views",
  minEngagement: "Minimum engagement %",
  preferBrandHistory: "Use previous work with the same brand as a preference factor",
  saveSettings: "Save qualification criteria",
  score: "Campaign score",
  systemSuggestion: "System suggestion",
  staffDecision: "Campaign staff decision",
  generalScore: "General evaluation",
  campaignFit: "Campaign fit",
  campaignFitNote: "Campaign-fit note",
  staffNotes: "Staff notes",
  reason: "Decision reason",
  noDecision: "Not set yet",
  chooseRating: "Choose a rating",
  saveEvaluation: "Save campaign evaluation",
  city: "City",
  platform: "Platform",
  followers: "Followers",
  views: "Views",
  engagement: "Engagement",
  brandHistory: "Same-brand experience",
  match: "Match",
  noMatch: "No match",
  notRequired: "Not required",
  previousWorks: "Previous work with brand",
  setupMissing: "Apply the Phase 08.2 database patch to show campaign qualification.",
  statuses: { qualified: "Qualified", needs_review: "Needs review", waitlist: "Waitlist", not_qualified: "Not qualified" },
  ratings: ["", "Weak", "Acceptable", "Good", "Very good", "Excellent"],
  breakdown: {
    general_evaluation: "General evaluation",
    campaign_fit: "Campaign fit",
    same_brand_history: "Brand history",
    city: "City",
    platform: "Platform",
    followers: "Followers",
    average_views: "Views",
    engagement: "Engagement",
  },
};

const breakdownMax: Record<string, number> = {
  general_evaluation: 30,
  campaign_fit: 15,
  same_brand_history: 15,
  city: 10,
  platform: 10,
  followers: 8,
  average_views: 7,
  engagement: 5,
};

export function CampaignQualificationSettingsPanel({
  campaignId,
  locale,
  settings,
  setupAvailable,
}: {
  campaignId: string;
  locale: Locale;
  settings: CampaignQualificationSettings | null;
  setupAvailable: boolean;
}) {
  const c = locale === "en" ? EN : AR;
  if (!setupAvailable) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">{c.setupMissing}</div>;
  }

  return (
    <section className="rounded-[26px] border border-[#ECE1F1] bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-black text-[#4C335F]">{c.settingsTitle}</h2>
        <p className="mt-1 text-sm font-semibold text-[#8A92AA]">{c.settingsDescription}</p>
      </div>
      <form action={saveCampaignQualificationSettings} className="mt-5 grid gap-4 lg:grid-cols-3">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <Field label={c.targetCities} hint={c.listHint}>
          <textarea name="target_cities" rows={3} defaultValue={(settings?.target_cities ?? []).join("\n")} className={input} />
        </Field>
        <Field label={c.targetPlatforms} hint={c.listHint}>
          <textarea name="target_platforms" rows={3} defaultValue={(settings?.target_platforms ?? []).join("\n")} className={input} dir="ltr" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <Field label={c.minFollowers}><input name="min_followers" type="number" min="0" defaultValue={settings?.min_followers ?? ""} className={input} /></Field>
          <Field label={c.minViews}><input name="min_average_views" type="number" min="0" step="0.01" defaultValue={settings?.min_average_views ?? ""} className={input} /></Field>
          <Field label={c.minEngagement}><input name="min_engagement_rate" type="number" min="0" step="0.01" defaultValue={settings?.min_engagement_rate ?? ""} className={input} /></Field>
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-[#EAE3F0] bg-[#FCFAFD] p-4 lg:col-span-2">
          <input name="prefer_previous_brand_experience" type="checkbox" defaultChecked={Boolean(settings?.prefer_previous_brand_experience)} className="h-5 w-5" />
          <span className="text-sm font-black text-[#5B4667]">{c.preferBrandHistory}</span>
        </label>
        <div className="flex items-end justify-end">
          <button className="rounded-xl bg-[#8C5BA5] px-5 py-3 text-sm font-black text-white shadow-sm">{c.saveSettings}</button>
        </div>
      </form>
    </section>
  );
}

export function CampaignApplicationQualificationPanel({
  campaignId,
  applicationId,
  locale,
  summary,
}: {
  campaignId: string;
  applicationId: string;
  locale: Locale;
  summary: CampaignApplicationQualificationSummary | null;
}) {
  const c = locale === "en" ? EN : AR;
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { maximumFractionDigits: 2 });
  if (!summary) {
    return <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">{c.setupMissing}</div>;
  }

  const suggested = summary.suggested_status ?? "needs_review";
  const metrics = summary.metrics ?? {};
  const criteria = summary.criteria ?? {};
  const general = summary.general_evaluation ?? {};

  return (
    <div className="mt-4 rounded-2xl border border-[#E8E0F0] bg-[#FBF9FD] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge label={c.score} value={`${number.format(Number(summary.total_score ?? 0))}/100`} />
          <StatusBadge label={c.systemSuggestion} status={suggested} text={c.statuses[suggested]} />
          <StatusBadge label={c.staffDecision} status={summary.final_status ?? undefined} text={summary.final_status ? c.statuses[summary.final_status] : c.noDecision} />
          <Badge label={c.generalScore} value={`${number.format(Number(general.total_score ?? 0))}/100`} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Criterion label={c.city} state={criteria.city_match} value={metrics.city || "—"} c={c} />
        <Criterion label={c.platform} state={criteria.platform_match} value={(metrics.platforms ?? []).join(" / ") || "—"} c={c} />
        <Criterion label={c.followers} state={criteria.followers_match} value={number.format(Number(metrics.total_followers ?? 0))} c={c} />
        <Criterion label={c.views} state={criteria.views_match} value={number.format(Number(metrics.average_views ?? 0))} c={c} />
        <Criterion label={c.engagement} state={criteria.engagement_match} value={`${number.format(Number(metrics.average_engagement ?? 0))}%`} c={c} />
        <Criterion label={c.brandHistory} state={criteria.brand_history_match} value={`${number.format(Number(metrics.same_brand_history_count ?? 0))} ${c.previousWorks}`} c={c} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {Object.entries(summary.score_breakdown ?? {}).map(([key, value]) => (
          <div key={key} className="rounded-xl bg-white px-3 py-2">
            <p className="text-[10px] font-bold text-[#96859E]">{(c.breakdown as Record<string, string>)[key] ?? key}</p>
            <p className="mt-1 text-xs font-black text-[#5364AA]">{number.format(Number(value ?? 0))}/{breakdownMax[key] ?? 0}</p>
          </div>
        ))}
      </div>

      <form action={saveCampaignApplicationEvaluation} className="mt-4 grid gap-3 border-t border-[#E8E0F0] pt-4 lg:grid-cols-2">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="application_id" value={applicationId} />
        <Field label={c.campaignFit}>
          <select name="campaign_fit_rating" defaultValue={summary.campaign_fit_rating ?? ""} className={input}>
            <option value="">{c.chooseRating}</option>
            {[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating}/5 - {c.ratings[rating]}</option>)}
          </select>
        </Field>
        <Field label={c.campaignFitNote}>
          <input name="campaign_fit_notes" defaultValue={summary.campaign_fit_notes ?? ""} className={input} />
        </Field>
        <Field label={c.staffDecision}>
          <select name="final_status" defaultValue={summary.final_status ?? ""} className={input}>
            <option value="">{c.noDecision}</option>
            <option value="qualified">{c.statuses.qualified}</option>
            <option value="needs_review">{c.statuses.needs_review}</option>
            <option value="waitlist">{c.statuses.waitlist}</option>
            <option value="not_qualified">{c.statuses.not_qualified}</option>
          </select>
        </Field>
        <Field label={c.reason}>
          <input name="final_reason" defaultValue={summary.final_reason ?? ""} className={input} />
        </Field>
        <Field label={c.staffNotes}>
          <textarea name="staff_notes" rows={2} defaultValue={summary.staff_notes ?? ""} className={input} />
        </Field>
        <div className="flex items-end justify-end">
          <button className="rounded-xl bg-[#6E63B6] px-5 py-3 text-sm font-black text-white shadow-sm">{c.saveEvaluation}</button>
        </div>
      </form>
    </div>
  );
}

const input = "mt-2 min-h-11 w-full rounded-xl border border-[#E0E5F5] bg-white px-3 py-2 text-sm font-bold text-[#53618D] outline-none focus:border-[#9A6AAE]";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-black text-[#6D5A78]">{label}</span>{hint ? <span className="ms-2 text-[10px] font-semibold text-[#A1A5B5]">{hint}</span> : null}{children}</label>;
}

function Badge({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white px-3 py-2"><p className="text-[10px] font-bold text-[#96859E]">{label}</p><p className="mt-1 text-sm font-black text-[#5364AA]">{value}</p></div>;
}

function StatusBadge({ label, status, text }: { label: string; status?: EvaluationStatus; text: string }) {
  const tone = status === "qualified" ? "bg-emerald-50 text-emerald-800" : status === "waitlist" ? "bg-amber-50 text-amber-800" : status === "not_qualified" ? "bg-rose-50 text-rose-800" : "bg-blue-50 text-blue-800";
  return <div className={`rounded-xl px-3 py-2 ${tone}`}><p className="text-[10px] font-bold opacity-70">{label}</p><p className="mt-1 text-sm font-black">{text}</p></div>;
}

function Criterion({ label, state, value, c }: { label: string; state?: boolean | null; value: string; c: typeof EN }) {
  const status = state === null || state === undefined ? c.notRequired : state ? c.match : c.noMatch;
  const tone = state === null || state === undefined ? "text-[#8A92AA]" : state ? "text-emerald-700" : "text-rose-700";
  return <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-bold text-[#96859E]">{label}</p><p className="mt-1 truncate text-xs font-black text-[#5B4667]">{value}</p><p className={`mt-1 text-[10px] font-black ${tone}`}>{status}</p></div>;
}

export function campaignQualificationMessage(locale: Locale, code: string) {
  const ar: Record<string, string> = {
    saved: "تم حفظ تقييم الحملة.",
    settings_saved: "تم حفظ معايير التأهيل.",
    qualification_invalid_numbers: "راجع الأرقام المستخدمة في معايير التأهيل.",
    qualification_settings_failed: "تعذر حفظ معايير التأهيل للحملة.",
    qualification_invalid_evaluation: "راجع بيانات تقييم الحملة.",
    qualification_reason_required: "اكتب سبب القرار عند اختيار قائمة انتظار أو غير مؤهل.",
    qualification_save_failed: "تعذر حفظ تقييم الحملة.",
  };
  const en: Record<string, string> = {
    saved: "Campaign evaluation saved.",
    settings_saved: "Qualification criteria saved.",
    qualification_invalid_numbers: "Review the numeric qualification criteria.",
    qualification_settings_failed: "Could not save campaign qualification criteria.",
    qualification_invalid_evaluation: "Review the campaign evaluation values.",
    qualification_reason_required: "Add a reason when selecting Waitlist or Not qualified.",
    qualification_save_failed: "Could not save the campaign evaluation.",
  };
  return (locale === "en" ? en : ar)[code] ?? null;
}
