import { updateAssignmentExecutionWorkflow } from "./actions";

type Locale = "ar" | "en";

type Props = {
  locale: Locale;
  campaignId: string;
  assignmentId: string;
  status: string;
  acceptedAt: string | null;
  briefSentAt: string | null;
  briefVersionSent: number | null;
  campaignBrief: string | null;
  assignmentBriefOverride: string | null;
  productRequired: boolean;
  productFulfillmentStatus: string;
  productDispatchedAt: string | null;
  productReceivedAt: string | null;
  contentDueAt: string | null;
  publishingDate: string | null;
  executionNotes: string | null;
  coordinatorProgress: number | null;
  canManage: boolean;
};

const copy = {
  ar: {
    title: "تنفيذ الحملة",
    subtitle: "تابع قبول المؤثر، البريف، المنتج / PR، ثم انتقال التكليف إلى مرحلة المحتوى.",
    progress: "التقدم",
    accepted: "قبول المؤثر",
    brief: "إرسال البريف",
    product: "استلام المنتج / PR",
    content: "جاهز للمحتوى",
    done: "مكتمل",
    pending: "بانتظار التنفيذ",
    notRequired: "غير مطلوب",
    productPending: "بانتظار التجهيز",
    productDispatched: "تم الإرسال",
    productReceived: "تم الاستلام",
    confirmAcceptance: "تأكيد قبول المؤثر",
    markBriefSent: "تأكيد إرسال البريف",
    requireProduct: "يتطلب منتج / PR",
    markDispatched: "تم إرسال المنتج",
    markReceived: "تم استلام المنتج",
    noProduct: "لا يتطلب منتج",
    moveContent: "نقل إلى انتظار المحتوى",
    details: "تفاصيل التنفيذ",
    briefOverride: "ملاحظات بريف خاصة بهذا المؤثر",
    briefPlaceholder: "اتركه فارغًا لاستخدام بريف الحملة كما هو.",
    contentDue: "موعد تسليم المحتوى",
    publishingDate: "تاريخ النشر",
    productRequired: "هل يتطلب منتج / PR؟",
    yes: "نعم",
    no: "لا",
    notes: "ملاحظات المنسق",
    save: "حفظ التفاصيل",
    campaignBrief: "بريف الحملة",
    version: "نسخة",
    dateNotSet: "غير محدد",
  },
  en: {
    title: "Campaign execution",
    subtitle: "Track creator acceptance, the brief, product / PR fulfillment, and readiness for content.",
    progress: "Progress",
    accepted: "Creator accepted",
    brief: "Brief sent",
    product: "Product / PR received",
    content: "Ready for content",
    done: "Done",
    pending: "Pending",
    notRequired: "Not required",
    productPending: "Preparing",
    productDispatched: "Dispatched",
    productReceived: "Received",
    confirmAcceptance: "Confirm creator acceptance",
    markBriefSent: "Confirm brief sent",
    requireProduct: "Product / PR required",
    markDispatched: "Mark product dispatched",
    markReceived: "Mark product received",
    noProduct: "No product required",
    moveContent: "Move to awaiting content",
    details: "Execution details",
    briefOverride: "Creator-specific brief notes",
    briefPlaceholder: "Leave blank to use the campaign brief as-is.",
    contentDue: "Content due date",
    publishingDate: "Publishing date",
    productRequired: "Product / PR required?",
    yes: "Yes",
    no: "No",
    notes: "Coordinator notes",
    save: "Save details",
    campaignBrief: "Campaign brief",
    version: "Version",
    dateNotSet: "Not set",
  },
} as const;

function dateTimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function productLabel(locale: Locale, status: string, required: boolean) {
  const c = copy[locale];
  if (!required || status === "not_required") return c.notRequired;
  if (status === "received") return c.productReceived;
  if (status === "dispatched") return c.productDispatched;
  return c.productPending;
}

function Stage({ label, complete, detail }: { label: string; complete: boolean; detail?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${complete ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-xs font-black ${complete ? "text-emerald-800" : "text-amber-800"}`}>{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${complete ? "bg-emerald-500" : "bg-amber-400"}`} />
      </div>
      {detail ? <p className={`mt-2 text-xs font-bold ${complete ? "text-emerald-700" : "text-amber-700"}`}>{detail}</p> : null}
    </div>
  );
}

function Hidden({ campaignId, assignmentId, action }: { campaignId: string; assignmentId: string; action: string }) {
  return <><input type="hidden" name="campaign_id" value={campaignId} /><input type="hidden" name="assignment_id" value={assignmentId} /><input type="hidden" name="workflow_action" value={action} /></>;
}

export default function ExecutionWorkflowPanel(props: Props) {
  const c = copy[props.locale];
  const accepted = Boolean(props.acceptedAt) || !["invited", "rejected", "cancelled"].includes(props.status);
  const briefSent = Boolean(props.briefSentAt);
  const productComplete = !props.productRequired || props.productFulfillmentStatus === "received" || Boolean(props.productReceivedAt);
  const contentReady = ["content_pending", "under_review", "needs_changes", "approved", "payment_pending", "paid", "closed"].includes(props.status);
  const terminal = ["rejected", "cancelled", "closed"].includes(props.status);

  return (
    <section className="rounded-[28px] border border-[#E9DFF0] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-[#4C335F]">{c.title}</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold leading-7 text-[#88758F]">{c.subtitle}</p>
        </div>
        <div className="rounded-2xl bg-[#F7F0FA] px-4 py-3 text-center">
          <p className="text-[11px] font-black text-[#8D6B9D]">{c.progress}</p>
          <p className="mt-1 text-2xl font-black text-[#6D467F]">{Math.round(Number(props.coordinatorProgress ?? 0))}%</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stage label={c.accepted} complete={accepted} detail={accepted ? c.done : c.pending} />
        <Stage label={c.brief} complete={briefSent} detail={props.briefVersionSent ? `${c.version} ${props.briefVersionSent}` : briefSent ? c.done : c.pending} />
        <Stage label={c.product} complete={productComplete} detail={productLabel(props.locale, props.productFulfillmentStatus, props.productRequired)} />
        <Stage label={c.content} complete={contentReady} detail={contentReady ? c.done : c.pending} />
      </div>

      {props.canManage && !terminal ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {!props.acceptedAt ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="confirm_acceptance" /><button className="rounded-xl bg-[#704680] px-4 py-2.5 text-xs font-black text-white">{c.confirmAcceptance}</button></form> : null}
          {!props.briefSentAt ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="send_brief" /><button className="rounded-xl bg-[#9B69B4] px-4 py-2.5 text-xs font-black text-white">{c.markBriefSent}</button></form> : null}
          {!props.productRequired ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="product_pending" /><button className="rounded-xl border border-[#DCCBE4] bg-white px-4 py-2.5 text-xs font-black text-[#6D467F]">{c.requireProduct}</button></form> : null}
          {props.productRequired && props.productFulfillmentStatus === "pending" ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="product_dispatched" /><button className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-xs font-black text-sky-700">{c.markDispatched}</button></form> : null}
          {props.productRequired && props.productFulfillmentStatus !== "received" ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="product_received" /><button className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-700">{c.markReceived}</button></form> : null}
          {props.productRequired ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="product_not_required" /><button className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-600">{c.noProduct}</button></form> : null}
          {accepted && briefSent && productComplete && !contentReady ? <form action={updateAssignmentExecutionWorkflow}><Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="content_pending" /><button className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">{c.moveContent}</button></form> : null}
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-[#EEE4F2] bg-[#FBF8FD] p-4">
          <p className="text-xs font-black text-[#6D5677]">{c.campaignBrief}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-[#66536E]">{props.assignmentBriefOverride || props.campaignBrief || c.dateNotSet}</p>
        </div>

        {props.canManage ? (
          <form action={updateAssignmentExecutionWorkflow} className="rounded-2xl border border-[#E7E1EC] bg-white p-4">
            <Hidden campaignId={props.campaignId} assignmentId={props.assignmentId} action="save_details" />
            <p className="text-sm font-black text-[#4C335F]">{c.details}</p>
            <label className="mt-4 block text-xs font-black text-[#78657F]">{c.briefOverride}</label>
            <textarea name="brief_override" defaultValue={props.assignmentBriefOverride ?? ""} rows={3} placeholder={c.briefPlaceholder} className="mt-2 w-full rounded-xl border border-[#E7DCEB] bg-white p-3 text-sm font-semibold outline-none focus:border-[#A170BA]" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black text-[#78657F]">{c.contentDue}<input type="datetime-local" name="content_due_at" defaultValue={dateTimeLocal(props.contentDueAt)} className="mt-2 h-11 w-full rounded-xl border border-[#E7DCEB] px-3 text-sm font-bold outline-none" /></label>
              <label className="text-xs font-black text-[#78657F]">{c.publishingDate}<input type="date" name="publishing_date" defaultValue={props.publishingDate ?? ""} className="mt-2 h-11 w-full rounded-xl border border-[#E7DCEB] px-3 text-sm font-bold outline-none" /></label>
            </div>
            <label className="mt-3 block text-xs font-black text-[#78657F]">{c.productRequired}</label>
            <select name="product_required" defaultValue={props.productRequired ? "true" : "false"} className="mt-2 h-11 w-full rounded-xl border border-[#E7DCEB] bg-white px-3 text-sm font-bold outline-none"><option value="false">{c.no}</option><option value="true">{c.yes}</option></select>
            <label className="mt-3 block text-xs font-black text-[#78657F]">{c.notes}</label>
            <textarea name="notes" defaultValue={props.executionNotes ?? ""} rows={3} className="mt-2 w-full rounded-xl border border-[#E7DCEB] bg-white p-3 text-sm font-semibold outline-none focus:border-[#A170BA]" />
            <button className="mt-4 w-full rounded-xl bg-[#6D467F] px-4 py-3 text-sm font-black text-white">{c.save}</button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
