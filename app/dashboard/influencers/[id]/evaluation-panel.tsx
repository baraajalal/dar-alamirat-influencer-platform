import { saveInfluencerEvaluation } from "./evaluation-actions";

type EvaluationStatus = "qualified" | "needs_review" | "waitlist" | "not_qualified";

export type EvaluationSummary = {
  evaluation_exists?: boolean;
  scoring_version?: string;
  manual_complete?: boolean;
  total_score?: number;
  suggested_status?: EvaluationStatus;
  final_status?: EvaluationStatus | null;
  final_reason?: string | null;
  evaluator_name?: string | null;
  evaluated_at?: string | null;
  metrics?: {
    profile_completion?: number;
    city?: string | null;
    platforms?: string[];
    social_account_count?: number;
    total_followers?: number;
    average_views?: number;
    average_engagement?: number;
    work_history_count?: number;
    positive_history_count?: number;
    neutral_history_count?: number;
    needs_attention_history_count?: number;
    previous_brand_count?: number;
  };
  score_breakdown?: Record<string, number>;
  manual?: {
    content_quality_rating?: number | null;
    brand_fit_rating?: number | null;
    reliability_rating?: number | null;
    content_quality_notes?: string | null;
    brand_fit_notes?: string | null;
    reliability_notes?: string | null;
  };
};

type Props = {
  influencerId: string;
  locale: "ar" | "en";
  canEvaluate: boolean;
  summary: EvaluationSummary | null;
  saved?: boolean;
  errorCode?: string;
};

const AR = {
  title: "\u0627\u0644\u062a\u0623\u0647\u064a\u0644 \u0648\u0627\u0644\u062a\u0642\u064a\u064a\u0645",
  subtitle: "\u062f\u0639\u0645 \u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0641\u0631\u064a\u0642 \u0628\u0646\u0627\u0621\u064b \u0639\u0644\u0649 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0648\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0633\u0627\u0628\u0642\u0629. \u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0646\u0647\u0627\u0626\u064a \u062f\u0627\u0626\u0645\u064b\u0627 \u0644\u0644\u0645\u0648\u0638\u0641.",
  score: "\u0627\u0644\u0646\u062a\u064a\u062c\u0629",
  suggestion: "\u0627\u0642\u062a\u0631\u0627\u062d \u0627\u0644\u0646\u0638\u0627\u0645",
  finalDecision: "\u0642\u0631\u0627\u0631 \u0627\u0644\u0641\u0631\u064a\u0642",
  noDecision: "\u0644\u0645 \u064a\u062d\u062f\u062f \u0628\u0639\u062f",
  systemOnly: "\u0627\u0644\u0646\u062a\u064a\u062c\u0629 \u0627\u0644\u0622\u0644\u064a\u0629 \u0627\u0633\u062a\u0631\u0634\u0627\u062f\u064a\u0629 \u0641\u0642\u0637 \u0648\u0644\u0627 \u062a\u0639\u062a\u0628\u0631 \u0642\u0631\u0627\u0631\u064b\u0627 \u0646\u0647\u0627\u0626\u064a\u064b\u0627.",
  setupMissing: "\u0644\u0645 \u064a\u062a\u0645 \u062a\u0637\u0628\u064a\u0642 \u0642\u0627\u0639\u062f\u0629 \u0628\u064a\u0627\u0646\u0627\u062a Phase 08.1 \u0628\u0639\u062f.",
  saved: "\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0628\u0646\u062c\u0627\u062d.",
  saveFailed: "\u062a\u0639\u0630\u0631 \u062d\u0641\u0638 \u0627\u0644\u062a\u0642\u064a\u064a\u0645.",
  validation: "\u0631\u0627\u062c\u0639 \u0642\u064a\u0645 \u0627\u0644\u062a\u0642\u064a\u064a\u0645.",
  reasonRequired: "\u0627\u0643\u062a\u0628 \u0633\u0628\u0628 \u0627\u0644\u0642\u0631\u0627\u0631 \u0639\u0646\u062f \u0627\u062e\u062a\u064a\u0627\u0631 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631 \u0623\u0648 \u063a\u064a\u0631 \u0645\u0624\u0647\u0644.",
  unauthorized: "\u0644\u0627 \u062a\u0645\u0644\u0643 \u0635\u0644\u0627\u062d\u064a\u0629 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645.",
  contentQuality: "\u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u062d\u062a\u0648\u0649",
  brandFit: "\u0645\u0644\u0627\u0621\u0645\u0629 \u0627\u0644\u0628\u0631\u0627\u0646\u062f",
  reliability: "\u0627\u0644\u0627\u0644\u062a\u0632\u0627\u0645 \u0627\u0644\u0633\u0627\u0628\u0642",
  note: "\u0645\u0644\u0627\u062d\u0638\u0629",
  choose: "\u0627\u062e\u062a\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
  finalReason: "\u0633\u0628\u0628 / \u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0642\u0631\u0627\u0631",
  save: "\u062d\u0641\u0638 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
  profile: "\u0627\u0643\u062a\u0645\u0627\u0644 \u0627\u0644\u0645\u0644\u0641",
  city: "\u0627\u0644\u0645\u062f\u064a\u0646\u0629",
  platforms: "\u0627\u0644\u0645\u0646\u0635\u0627\u062a",
  followers: "\u0627\u0644\u0645\u062a\u0627\u0628\u0639\u0648\u0646",
  views: "\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0627\u062a",
  engagement: "\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u062a\u0641\u0627\u0639\u0644",
  work: "\u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0627\u0644\u0633\u0627\u0628\u0642\u0629",
  brands: "\u0628\u0631\u0627\u0646\u062f\u0627\u062a \u0633\u0627\u0628\u0642\u0629",
  breakdown: "\u062a\u0641\u0635\u064a\u0644 \u0627\u0644\u0646\u0642\u0627\u0637",
  lastEvaluator: "\u0622\u062e\u0631 \u062a\u0642\u064a\u064a\u0645",
  statuses: { qualified: "\u0645\u0624\u0647\u0644", needs_review: "\u064a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629", waitlist: "\u0642\u0627\u0626\u0645\u0629 \u0627\u0646\u062a\u0638\u0627\u0631", not_qualified: "\u063a\u064a\u0631 \u0645\u0624\u0647\u0644" },
  ratingLabels: ["", "\u0636\u0639\u064a\u0641", "\u0645\u0642\u0628\u0648\u0644", "\u062c\u064a\u062f", "\u062c\u064a\u062f \u062c\u062f\u064b\u0627", "\u0645\u0645\u062a\u0627\u0632"],
};

const EN = {
  title: "Qualification & evaluation",
  subtitle: "Decision support based on profile data and previous work. The staff member always makes the final decision.",
  score: "Score",
  suggestion: "System suggestion",
  finalDecision: "Staff decision",
  noDecision: "Not set yet",
  systemOnly: "The automated result is guidance only and is never the final decision.",
  setupMissing: "The Phase 08.1 database patch has not been applied yet.",
  saved: "Evaluation saved successfully.",
  saveFailed: "Could not save the evaluation.",
  validation: "Review the evaluation values.",
  reasonRequired: "Add a reason when selecting Waitlist or Not qualified.",
  unauthorized: "You do not have permission to edit this evaluation.",
  contentQuality: "Content quality",
  brandFit: "Brand fit",
  reliability: "Previous reliability",
  note: "Note",
  choose: "Choose a rating",
  finalReason: "Decision reason / note",
  save: "Save evaluation",
  profile: "Profile completion",
  city: "City",
  platforms: "Platforms",
  followers: "Followers",
  views: "Average views",
  engagement: "Average engagement",
  work: "Previous work",
  brands: "Previous brands",
  breakdown: "Score breakdown",
  lastEvaluator: "Last evaluation",
  statuses: { qualified: "Qualified", needs_review: "Needs review", waitlist: "Waitlist", not_qualified: "Not qualified" },
  ratingLabels: ["", "Weak", "Acceptable", "Good", "Very good", "Excellent"],
};

const breakdownMax: Record<string, number> = {
  content_quality: 20,
  brand_fit: 15,
  reliability: 15,
  city: 5,
  platform: 5,
  followers: 10,
  average_views: 10,
  engagement: 10,
  past_work: 10,
};

function tone(status?: EvaluationStatus | null) {
  if (status === "qualified") return "bg-emerald-50 text-emerald-800";
  if (status === "waitlist") return "bg-amber-50 text-amber-800";
  if (status === "not_qualified") return "bg-rose-50 text-rose-800";
  return "bg-blue-50 text-blue-800";
}

export function InfluencerEvaluationPanel({ influencerId, locale, canEvaluate, summary, saved, errorCode }: Props) {
  const c = locale === "en" ? EN : AR;
  const number = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA");
  const percent = (value: number | undefined) => `${Number(value ?? 0).toFixed(1)}%`;

  if (!summary) {
    return (
      <section id="evaluation" className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6">
        <h3 className="text-lg font-black text-[#4A315C]">{c.title}</h3>
        <p className="mt-2 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">{c.setupMissing}</p>
      </section>
    );
  }

  const metrics = summary.metrics ?? {};
  const manual = summary.manual ?? {};
  const suggested = summary.suggested_status ?? "needs_review";
  const errorText = errorCode === "reason_required" ? c.reasonRequired : errorCode === "validation" ? c.validation : errorCode === "unauthorized" ? c.unauthorized : errorCode ? c.saveFailed : null;

  return (
    <section id="evaluation" className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h3 className="text-lg font-black text-[#4A315C]">{c.title}</h3>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-[#8A92AA]">{c.subtitle}</p>
          <p className="mt-2 text-xs font-black text-[#9A6AAE]">{c.systemOnly}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="min-w-24 rounded-2xl bg-[#F7F0FA] px-4 py-3 text-center">
            <p className="text-[10px] font-black text-[#96859E]">{c.score}</p>
            <p className="mt-1 text-2xl font-black text-[#5364AA]">{number.format(Number(summary.total_score ?? 0))}/100</p>
          </div>
          <div className={`min-w-36 rounded-2xl px-4 py-3 ${tone(suggested)}`}>
            <p className="text-[10px] font-black opacity-70">{c.suggestion}</p>
            <p className="mt-1 text-sm font-black">{c.statuses[suggested]}</p>
          </div>
          <div className={`min-w-36 rounded-2xl px-4 py-3 ${tone(summary.final_status)}`}>
            <p className="text-[10px] font-black opacity-70">{c.finalDecision}</p>
            <p className="mt-1 text-sm font-black">{summary.final_status ? c.statuses[summary.final_status] : c.noDecision}</p>
          </div>
        </div>
      </div>

      {saved ? <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">{c.saved}</p> : null}
      {errorText ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-black text-rose-800">{errorText}</p> : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={c.profile} value={`${number.format(Number(metrics.profile_completion ?? 0))}%`} />
        <Metric label={c.city} value={metrics.city || "\u2014"} />
        <Metric label={c.platforms} value={(metrics.platforms ?? []).join(" / ") || "\u2014"} />
        <Metric label={c.followers} value={number.format(Number(metrics.total_followers ?? 0))} />
        <Metric label={c.views} value={number.format(Number(metrics.average_views ?? 0))} />
        <Metric label={c.engagement} value={percent(metrics.average_engagement)} />
        <Metric label={c.work} value={number.format(Number(metrics.work_history_count ?? 0))} />
        <Metric label={c.brands} value={number.format(Number(metrics.previous_brand_count ?? 0))} />
      </div>

      <div className="mt-5 rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4">
        <p className="text-sm font-black text-[#4A315C]">{c.breakdown}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {Object.entries(summary.score_breakdown ?? {}).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-white px-3 py-2">
              <p className="text-[10px] font-bold text-[#96859E]">{breakdownLabel(key, c)}</p>
              <p className="mt-1 text-xs font-black text-[#5364AA]">{number.format(Number(value ?? 0))}/{number.format(breakdownMax[key] ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>

      {canEvaluate ? (
        <form action={saveInfluencerEvaluation} className="mt-5 space-y-5">
          <input type="hidden" name="influencer_id" value={influencerId} />
          <div className="grid gap-4 lg:grid-cols-3">
            <RatingField name="content_quality_rating" notesName="content_quality_notes" label={c.contentQuality} noteLabel={c.note} choose={c.choose} labels={c.ratingLabels} value={manual.content_quality_rating} notes={manual.content_quality_notes} />
            <RatingField name="brand_fit_rating" notesName="brand_fit_notes" label={c.brandFit} noteLabel={c.note} choose={c.choose} labels={c.ratingLabels} value={manual.brand_fit_rating} notes={manual.brand_fit_notes} />
            <RatingField name="reliability_rating" notesName="reliability_notes" label={c.reliability} noteLabel={c.note} choose={c.choose} labels={c.ratingLabels} value={manual.reliability_rating} notes={manual.reliability_notes} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[.7fr_1.3fr]">
            <label className="block">
              <span className="text-xs font-black text-[#6D5A78]">{c.finalDecision}</span>
              <select name="final_status" defaultValue={summary.final_status ?? ""} className="mt-2 h-12 w-full rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold text-[#53618D]">
                <option value="">{c.noDecision}</option>
                <option value="qualified">{c.statuses.qualified}</option>
                <option value="needs_review">{c.statuses.needs_review}</option>
                <option value="waitlist">{c.statuses.waitlist}</option>
                <option value="not_qualified">{c.statuses.not_qualified}</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black text-[#6D5A78]">{c.finalReason}</span>
              <input name="final_reason" defaultValue={summary.final_reason ?? ""} className="mt-2 h-12 w-full rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold text-[#53618D]" />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE8F2] pt-4">
            <p className="text-xs font-bold text-[#9A9FB0]">{c.lastEvaluator}: {summary.evaluator_name || "\u2014"}</p>
            <button className="rounded-xl bg-[#8C5BA5] px-5 py-3 text-sm font-black text-white shadow-sm">{c.save}</button>
          </div>
        </form>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ReadRating label={c.contentQuality} value={manual.content_quality_rating} labels={c.ratingLabels} />
          <ReadRating label={c.brandFit} value={manual.brand_fit_rating} labels={c.ratingLabels} />
          <ReadRating label={c.reliability} value={manual.reliability_rating} labels={c.ratingLabels} />
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#F7F0FA] p-3"><p className="text-[10px] font-extrabold text-[#96859E]">{label}</p><p className="mt-1 text-sm font-black text-[#5364AA]">{value}</p></div>;
}

function RatingField({ name, notesName, label, noteLabel, choose, labels, value, notes }: { name: string; notesName: string; label: string; noteLabel: string; choose: string; labels: string[]; value?: number | null; notes?: string | null }) {
  return (
    <div className="rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4">
      <label className="block"><span className="text-sm font-black text-[#4A315C]">{label}</span><select name={name} defaultValue={value ?? ""} className="mt-3 h-11 w-full rounded-xl border border-[#E0E5F5] bg-white px-3 text-sm font-bold text-[#53618D]"><option value="">{choose}</option>{[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating}/5 - {labels[rating]}</option>)}</select></label>
      <label className="mt-3 block"><span className="text-xs font-bold text-[#8A92AA]">{noteLabel}</span><textarea name={notesName} defaultValue={notes ?? ""} rows={3} className="mt-2 w-full rounded-xl border border-[#E0E5F5] bg-white px-3 py-2 text-sm font-semibold text-[#53618D]" /></label>
    </div>
  );
}

function ReadRating({ label, value, labels }: { label: string; value?: number | null; labels: string[] }) {
  return <div className="rounded-2xl border border-[#EEE8F2] bg-[#FDFBFE] p-4"><p className="text-xs font-bold text-[#96859E]">{label}</p><p className="mt-2 text-sm font-black text-[#4A315C]">{value ? `${value}/5 - ${labels[value]}` : "\u2014"}</p></div>;
}

function breakdownLabel(key: string, copy: typeof EN) {
  const labels: Record<string, string> = {
    content_quality: copy.contentQuality,
    brand_fit: copy.brandFit,
    reliability: copy.reliability,
    city: copy.city,
    platform: copy.platforms,
    followers: copy.followers,
    average_views: copy.views,
    engagement: copy.engagement,
    past_work: copy.work,
  };
  return labels[key] ?? key;
}
