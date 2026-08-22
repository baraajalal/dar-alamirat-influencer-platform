import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requirePermission } from "@/lib/auth/require-user";
import { hasPermission } from "@/lib/auth/permissions";
import { normalizeDashboardLocale } from "@/lib/i18n/dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { DashboardIcon } from "@/components/dashboard/icons";
import {
  recordBankTransfer,
  reviewPayment,
  submitPaymentForApproval,
  updatePaymentFulfillment,
} from "../actions";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: string;
  assignment_id: string;
  compensation_id: string | null;
  type: string;
  amount: number | string | null;
  expected_amount: number | string | null;
  paid_amount: number | string | null;
  status: string;
  due_at: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  return_reason: string | null;
  rejection_reason: string | null;
  finance_batch_number: string | null;
  paid_at: string | null;
  finance_notes: string | null;
  voucher_status: string | null;
  voucher_code: string | null;
  voucher_delivered_at: string | null;
  product_status: string | null;
  product_shipped_at: string | null;
  product_delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

type AssignmentRow = {
  id: string;
  campaign_id: string;
  influencer_id: string;
  coordinator_id: string | null;
  status: string;
  execution_type: string | null;
  content_due_at: string | null;
  publishing_date: string | null;
  order_number: string | null;
  order_code: string | null;
  order_invoice_amount: number | string | null;
  has_contract: boolean | null;
  contract_reference: string | null;
  agreement_date: string | null;
  payment_timing: string | null;
  contract_notes: string | null;
  currency: string | null;
  settled_at: string | null;
  availability_blocked_until: string | null;
};

type CompensationRow = {
  id: string;
  assignment_id: string;
  type: string;
  amount: number | string | null;
  voucher_source: string | null;
  voucher_branch: string | null;
  voucher_redemption_method: string | null;
  product_description: string | null;
  product_reference_value: number | string | null;
  expected_payment_at: string | null;
  notes: string | null;
};

type TransactionRow = {
  id: string;
  amount: number | string;
  transferred_at: string;
  transfer_reference: string;
  finance_batch_number: string | null;
  source_bank: string | null;
  proof_path: string | null;
  notes: string | null;
  created_at: string;
};

const labels = {
  ar: {
    back: "العودة إلى المدفوعات",
    title: "تفاصيل المستحق",
    subtitle: "راجعي الاستحقاق والاعتماد والتنفيذ والتسوية من صفحة واحدة.",
    expected: "قيمة المستحق",
    paid: "المدفوع",
    remaining: "المتبقي",
    status: "الحالة",
    influencer: "المؤثر",
    campaign: "الحملة",
    mobile: "الجوال",
    campaignStatus: "حالة التكليف",
    execution: "نوع التعاون",
    timing: "توقيت الدفع",
    contract: "العقد والاتفاق",
    contractRef: "مرجع العقد",
    agreementDate: "تاريخ الاتفاق",
    dueDate: "موعد الاستحقاق",
    compensation: "تفاصيل المقابل",
    compensationType: "نوع المقابل",
    compensationAmount: "قيمة المقابل",
    compensationNotes: "ملاحظات المقابل",
    expectedPaymentAt: "موعد الدفع المتوقع",
    orderNumber: "رقم الطلب",
    orderCode: "كود الطلب",
    orderValue: "قيمة الطلب",
    voucherSource: "مصدر القسيمة",
    voucherBranch: "فرع القسيمة",
    productDescription: "وصف المنتجات",
    productValue: "القيمة المرجعية للمنتجات",
    financeData: "البيانات البنكية المحمية",
    accountHolder: "اسم صاحب الحساب",
    bank: "البنك",
    iban: "الآيبان",
    nationalId: "الهوية",
    noFinance: "لا توجد بيانات مالية محفوظة للمؤثر.",
    workflow: "سير الاعتماد",
    submit: "إرسال للمالية",
    approve: "اعتماد وجاهز للصرف",
    return: "إرجاع للتعديل",
    reject: "رفض المستحق",
    reason: "سبب الإرجاع أو الرفض",
    bankTransfer: "تسجيل تحويل بنكي",
    amount: "المبلغ المدفوع الآن",
    transferDate: "تاريخ ووقت التحويل",
    reference: "رقم التحويل",
    batch: "رقم مجموعة التحويل",
    sourceBank: "البنك المحول منه",
    proof: "إثبات التحويل PDF أو صورة",
    notes: "ملاحظات المالية",
    record: "حفظ التحويل",
    history: "سجل التحويلات",
    noTransactions: "لم يتم تسجيل أي تحويل حتى الآن.",
    proofLink: "فتح الإثبات",
    fulfillment: "التجهيز والتسليم",
    voucherCode: "كود القسيمة",
    update: "تحديث الحالة",
    systemNotes: "ملاحظات النظام",
    settlement: "التسوية والحظر",
    settledAt: "تاريخ اكتمال التسوية",
    blockedUntil: "المؤثر متاح بعد",
    notSettled: "لم تكتمل جميع أنواع المقابل بعد.",
    website: "الموقع الإلكتروني",
    branch: "الفرع",
  },
  en: {
    back: "Back to payments",
    title: "Due details",
    subtitle: "Review approval, execution and settlement from one page.",
    expected: "Expected amount",
    paid: "Paid",
    remaining: "Remaining",
    status: "Status",
    influencer: "Influencer",
    campaign: "Campaign",
    mobile: "Mobile",
    campaignStatus: "Assignment status",
    execution: "Collaboration type",
    timing: "Payment timing",
    contract: "Contract & agreement",
    contractRef: "Contract reference",
    agreementDate: "Agreement date",
    dueDate: "Due date",
    compensation: "Compensation details",
    compensationType: "Compensation type",
    compensationAmount: "Compensation amount",
    compensationNotes: "Compensation notes",
    expectedPaymentAt: "Expected payment date",
    orderNumber: "Order number",
    orderCode: "Order code",
    orderValue: "Order value",
    voucherSource: "Voucher source",
    voucherBranch: "Voucher branch",
    productDescription: "Product description",
    productValue: "Product reference value",
    financeData: "Protected bank details",
    accountHolder: "Account holder",
    bank: "Bank",
    iban: "IBAN",
    nationalId: "National ID",
    noFinance: "No financial profile is available.",
    workflow: "Approval workflow",
    submit: "Submit to finance",
    approve: "Approve for payment",
    return: "Return for changes",
    reject: "Reject due",
    reason: "Return or rejection reason",
    bankTransfer: "Record bank transfer",
    amount: "Amount paid now",
    transferDate: "Transfer date & time",
    reference: "Transfer reference",
    batch: "Finance batch number",
    sourceBank: "Source bank",
    proof: "Payment proof PDF or image",
    notes: "Finance notes",
    record: "Save transfer",
    history: "Transfer history",
    noTransactions: "No transfers have been recorded yet.",
    proofLink: "Open proof",
    fulfillment: "Fulfillment & delivery",
    voucherCode: "Voucher code",
    update: "Update status",
    systemNotes: "System notes",
    settlement: "Settlement & cooldown",
    settledAt: "Settlement completed",
    blockedUntil: "Influencer available after",
    notSettled: "All compensation items are not completed yet.",
    website: "Website",
    branch: "Branch",
  },
} as const;

const statusLabels = {
  ar: { draft: "مسودة", awaiting_approval: "بانتظار الاعتماد", ready_for_finance: "جاهز للمالية", partially_paid: "مدفوع جزئيًا", paid: "مكتمل", cancelled: "ملغي" },
  en: { draft: "Draft", awaiting_approval: "Awaiting approval", ready_for_finance: "Ready for finance", partially_paid: "Partially paid", paid: "Completed", cancelled: "Cancelled" },
} as const;

const typeLabels = {
  ar: { bank_transfer: "تحويل بنكي", voucher: "قسيمة مشتريات", product: "مقابل منتجات", commission: "عمولة", other: "أخرى" },
  en: { bank_transfer: "Bank transfer", voucher: "Shopping voucher", product: "Products", commission: "Commission", other: "Other" },
} as const;

const executionLabels = {
  ar: { home: "منزلي", in_branch: "حضوري", other: "أخرى" },
  en: { home: "Home", in_branch: "In branch", other: "Other" },
} as const;

const timingLabels = {
  ar: { before_publish: "قبل النشر", after_publish: "بعد النشر", by_agreement: "حسب الاتفاق" },
  en: { before_publish: "Before publishing", after_publish: "After publishing", by_agreement: "By agreement" },
} as const;

const voucherStates = {
  ar: { pending: "بانتظار التجهيز", preparing: "قيد التجهيز", ready: "جاهزة", delivered: "تم التسليم", redeemed: "تم الاستخدام" },
  en: { pending: "Pending", preparing: "Preparing", ready: "Ready", delivered: "Delivered", redeemed: "Redeemed" },
} as const;

const productStates = {
  ar: { pending: "بانتظار التجهيز", preparing: "قيد التجهيز", shipped: "تم الشحن", delivered: "تم التسليم" },
  en: { pending: "Pending", preparing: "Preparing", shipped: "Shipped", delivered: "Delivered" },
} as const;

const successMessages: Record<string, { ar: string; en: string }> = {
  submitted: { ar: "تم إرسال المستحق للمراجعة المالية.", en: "The due was submitted for finance review." },
  approve: { ar: "تم اعتماد المستحق وأصبح جاهزًا للتنفيذ.", en: "The due was approved for execution." },
  return: { ar: "تم إرجاع المستحق للتعديل.", en: "The due was returned for changes." },
  reject: { ar: "تم رفض المستحق.", en: "The due was rejected." },
  transfer_recorded: { ar: "تم تسجيل التحويل وتحديث المبلغ المدفوع.", en: "The transfer was recorded and paid total updated." },
  fulfillment_updated: { ar: "تم تحديث حالة التجهيز والتسليم.", en: "Fulfillment status was updated." },
};

const errorMessages: Record<string, { ar: string; en: string }> = {
  publish_link_required: { ar: "لا يمكن إرسال مستحق بعد النشر قبل اعتماد المحتوى وإضافة رابط النشر.", en: "Post-publish payment requires approved content and a publishing link." },
  contract_required: { ar: "الدفع قبل النشر يتطلب عقدًا أو اتفاقًا مسجلًا.", en: "Payment before publishing requires a registered contract." },
  influencer_account_required: { ar: "لا يمكن إرسال التحويل قبل تفعيل حساب المؤثر وتسجيل دخوله لاستكمال بيانات الدفع.", en: "The influencer must activate and sign in to their account before bank payment can proceed." },
  bank_profile_required: { ar: "بيانات البنك غير مؤكدة أو لم تعتمدها المالية بعد. راجعي قسم البيانات البنكية.", en: "Bank details are not confirmed or finance-approved yet." },
  not_awaiting_approval: { ar: "المستحق ليس في حالة انتظار الاعتماد.", en: "The due is not awaiting approval." },
  not_ready: { ar: "المستحق غير جاهز للتنفيذ المالي.", en: "The due is not ready for payment." },
  amount_exceeds_remaining: { ar: "المبلغ المدخل أكبر من المتبقي على المستحق.", en: "The entered amount exceeds the remaining balance." },
  duplicate_reference: { ar: "رقم التحويل مستخدم سابقًا لهذا المستحق.", en: "This transfer reference is already used." },
  invalid_proof: { ar: "إثبات التحويل يجب أن يكون PDF أو صورة وبحجم لا يتجاوز 10MB.", en: "Proof must be a PDF or image up to 10MB." },
  proof_upload_failed: { ar: "تعذر رفع إثبات التحويل.", en: "Could not upload the payment proof." },
  invalid_transfer: { ar: "راجعي بيانات التحويل المطلوبة.", en: "Review the required transfer details." },
  reason_required: { ar: "اكتبي سبب الإرجاع أو الرفض.", en: "A return or rejection reason is required." },
  operation_failed: { ar: "تعذر تنفيذ العملية حاليًا.", en: "The operation could not be completed." },
};

function num(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mask(value: string | null | undefined) {
  if (!value) return "—";
  const clean = value.replace(/\s/g, "");
  if (clean.length <= 7) return "••••";
  return `${clean.slice(0, 3)}••••••${clean.slice(-4)}`;
}

export default async function PaymentDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const { profile, supabase } = await requirePermission("payments", "view");
  const cookieStore = await cookies();
  const locale = normalizeDashboardLocale(cookieStore.get("dashboard_locale")?.value);
  const t = labels[locale];
  const statusText = statusLabels[locale];
  const typeText = typeLabels[locale];
  const canApprove = hasPermission(profile.role, "payments", "approve");
  const canPay = hasPermission(profile.role, "payments", "pay");
  const canSubmit = ["admin", "coordinator", "finance"].includes(profile.role);
  const canViewFinance = ["admin", "finance"].includes(profile.role);

  const { data: payment, error } = await supabase
    .from("payments")
    .select("id,assignment_id,compensation_id,type,amount,expected_amount,paid_amount,status,due_at,submitted_at,approved_at,return_reason,rejection_reason,finance_batch_number,paid_at,finance_notes,voucher_status,voucher_code,voucher_delivered_at,product_status,product_shipped_at,product_delivered_at,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!payment) notFound();
  const paymentRow = payment as PaymentRow;

  const { data: assignment, error: assignmentError } = await supabase
    .from("campaign_assignments")
    .select("id,campaign_id,influencer_id,coordinator_id,status,execution_type,content_due_at,publishing_date,order_number,order_code,order_invoice_amount,has_contract,contract_reference,agreement_date,payment_timing,contract_notes,currency,settled_at,availability_blocked_until")
    .eq("id", paymentRow.assignment_id)
    .single();

  if (assignmentError) throw new Error(assignmentError.message);
  const assignmentRow = assignment as AssignmentRow;

  const compensationQuery = paymentRow.compensation_id
    ? supabase
        .from("assignment_compensations")
        .select("id,assignment_id,type,amount,voucher_source,voucher_branch,voucher_redemption_method,product_description,product_reference_value,expected_payment_at,notes")
        .eq("id", paymentRow.compensation_id)
        .maybeSingle()
    : supabase
        .from("assignment_compensations")
        .select("id,assignment_id,type,amount,voucher_source,voucher_branch,voucher_redemption_method,product_description,product_reference_value,expected_payment_at,notes")
        .eq("assignment_id", paymentRow.assignment_id)
        .eq("type", paymentRow.type)
        .maybeSingle();

  const [{ data: campaign }, { data: influencer }, { data: compensationData }] = await Promise.all([
    supabase.from("campaigns").select("id,name,brand,status").eq("id", assignmentRow.campaign_id).single(),
    supabase.from("influencers").select("id,full_name,mobile_e164,email").eq("id", assignmentRow.influencer_id).single(),
    compensationQuery,
  ]);
  const compensation = (compensationData ?? null) as CompensationRow | null;

  const financialResult = canViewFinance
    ? await supabase.from("influencer_financial_profiles").select("account_holder_name,bank_name,iban,national_id").eq("influencer_id", assignmentRow.influencer_id).maybeSingle()
    : { data: null };

  let transactions: Array<TransactionRow & { proofUrl?: string }> = [];
  if (canViewFinance) {
    const { data: transactionData } = await supabase
      .from("payment_transactions")
      .select("id,amount,transferred_at,transfer_reference,finance_batch_number,source_bank,proof_path,notes,created_at")
      .eq("payment_id", id)
      .order("transferred_at", { ascending: false });

    const admin = createAdminClient();
    transactions = await Promise.all(((transactionData ?? []) as TransactionRow[]).map(async (item) => {
      if (!item.proof_path) return item;
      const { data } = await admin.storage.from("payment-proofs").createSignedUrl(item.proof_path, 60 * 10);
      return { ...item, proofUrl: data?.signedUrl };
    }));
  }

  const storedExpected = num(paymentRow.expected_amount);
  const paymentAmount = num(paymentRow.amount);
  const compensationAmount = num(compensation?.amount);
  const expected = storedExpected > 0
    ? storedExpected
    : paymentAmount > 0
      ? paymentAmount
      : compensationAmount;
  const paid = num(paymentRow.paid_amount);
  const remaining = Math.max(expected - paid, 0);
  const effectiveDueAt = paymentRow.due_at ?? compensation?.expected_payment_at ?? null;
  const executionText = executionLabels[locale];
  const timingText = timingLabels[locale];
  const currency = /^[A-Z]{3}$/.test(assignmentRow.currency ?? "") ? assignmentRow.currency! : "SAR";
  const money = new Intl.NumberFormat(locale === "en" ? "en-US" : "ar-SA", { style: "currency", currency, maximumFractionDigits: 2 });
  const date = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium", timeStyle: "short" });
  const dateOnly = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar-SA", { dateStyle: "medium" });
  const success = query.success ? successMessages[query.success]?.[locale] : null;
  const alertError = query.error ? errorMessages[query.error]?.[locale] : null;
  const voucherText = voucherStates[locale];
  const productText = productStates[locale];
  const fulfillmentStates = paymentRow.type === "voucher" ? voucherText : productText;
  const currentFulfillment = paymentRow.type === "voucher" ? paymentRow.voucher_status ?? "pending" : paymentRow.product_status ?? "pending";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-2 text-sm font-black text-[#6372A4] transition hover:text-[#4458AD]">← {t.back}</Link>
        <div className="flex flex-wrap items-center gap-2">
          {canViewFinance && paymentRow.type === "bank_transfer" ? (
            <Link href="/dashboard/finance/bank-profiles" className="rounded-full border border-[#CBD3EF] bg-white px-4 py-2 text-xs font-black text-[#5669BE]">مراجعة بيانات البنك</Link>
          ) : null}
          <span className="rounded-full bg-[#F7F0FA] px-4 py-2 text-xs font-black text-[#5669BE]">{typeText[paymentRow.type as keyof typeof typeText] ?? paymentRow.type}</span>
        </div>
      </div>

      {success ? <Notice tone="success" text={success} /> : null}
      {alertError ? <Notice tone="error" text={alertError} /> : null}

      <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(135deg,#5268C3_0%,#7486D6_60%,#A9B7E8_100%)] p-6 text-white shadow-[0_24px_65px_rgba(63,81,171,.24)] sm:p-8">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full border border-white/12" />
        <div className="relative flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20"><DashboardIcon name="payments" className="h-6 w-6" /></span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">{t.title}</h1>
            <p className="mt-2 text-sm font-bold text-white/72">{t.subtitle}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/14 px-3 py-1.5 text-xs font-black ring-1 ring-white/15">{statusText[paymentRow.status as keyof typeof statusText] ?? paymentRow.status}</span>
              {assignmentRow.has_contract ? <span className="rounded-full bg-[#FBD97A]/20 px-3 py-1.5 text-xs font-black text-[#FFF4C6] ring-1 ring-[#FBD97A]/25">{t.contract}</span> : null}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <HeroMetric label={t.expected} value={money.format(expected)} />
            <HeroMetric label={t.paid} value={money.format(paid)} />
            <HeroMetric label={t.remaining} value={money.format(remaining)} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div className="space-y-6">
          <Panel title={t.influencer}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label={t.influencer} value={influencer?.full_name} />
              <Info label={t.mobile} value={influencer?.mobile_e164} ltr />
              <Info label={t.campaign} value={campaign?.name} />
              <Info label={t.campaignStatus} value={assignmentRow.status} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/dashboard/influencers/${assignmentRow.influencer_id}`} className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#915FA9]">{t.influencer}</Link>
              <Link href={`/dashboard/campaigns/${assignmentRow.campaign_id}`} className="rounded-xl bg-[#F7F0FA] px-3 py-2 text-xs font-black text-[#915FA9]">{t.campaign}</Link>
            </div>
          </Panel>

          <Panel title={t.compensation}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label={t.compensationType} value={typeText[paymentRow.type as keyof typeof typeText] ?? paymentRow.type} />
              <Info label={t.compensationAmount} value={money.format(expected)} />
              <Info label={t.execution} value={executionText[assignmentRow.execution_type as keyof typeof executionText] ?? assignmentRow.execution_type} />
              <Info label={t.timing} value={timingText[assignmentRow.payment_timing as keyof typeof timingText] ?? assignmentRow.payment_timing} />
              <Info label={t.dueDate} value={effectiveDueAt ? dateOnly.format(new Date(effectiveDueAt)) : null} />
              <Info label={t.expectedPaymentAt} value={compensation?.expected_payment_at ? dateOnly.format(new Date(compensation.expected_payment_at)) : null} />
              <Info label={t.orderNumber} value={assignmentRow.order_number} />
              <Info label={t.orderCode} value={assignmentRow.order_code} />
              <Info label={t.orderValue} value={assignmentRow.order_invoice_amount != null ? money.format(num(assignmentRow.order_invoice_amount)) : null} />
              {paymentRow.type === "voucher" ? <><Info label={t.voucherSource} value={compensation?.voucher_source === "website" ? t.website : compensation?.voucher_source === "branch" ? t.branch : compensation?.voucher_source} /><Info label={t.voucherBranch} value={compensation?.voucher_branch} /></> : null}
              {paymentRow.type === "product" ? <><Info label={t.productDescription} value={compensation?.product_description} /><Info label={t.productValue} value={compensation?.product_reference_value != null ? money.format(num(compensation.product_reference_value)) : null} /></> : null}
            </div>
            {compensation?.notes ? <div className="mt-4 rounded-2xl bg-[#FDFBFE] p-4"><p className="text-xs font-extrabold text-[#96859E]">{t.compensationNotes}</p><p className="mt-2 text-sm font-bold leading-7 text-[#6D5B77]">{compensation.notes}</p></div> : null}
          </Panel>

          {assignmentRow.has_contract ? <Panel title={t.contract}><div className="grid gap-4 sm:grid-cols-3"><Info label={t.contractRef} value={assignmentRow.contract_reference} /><Info label={t.agreementDate} value={assignmentRow.agreement_date ? dateOnly.format(new Date(`${assignmentRow.agreement_date}T00:00:00+03:00`)) : null} /><Info label={t.timing} value={timingText[assignmentRow.payment_timing as keyof typeof timingText] ?? assignmentRow.payment_timing} /></div>{assignmentRow.contract_notes ? <p className="mt-4 rounded-2xl bg-[#FDFBFE] p-4 text-sm font-bold leading-7 text-[#6D5B77]">{assignmentRow.contract_notes}</p> : null}</Panel> : null}

          {canViewFinance ? <Panel title={t.financeData}>{financialResult.data ? <div className="grid gap-4 sm:grid-cols-2"><Info label={t.accountHolder} value={financialResult.data.account_holder_name} /><Info label={t.bank} value={financialResult.data.bank_name} /><Info label={t.iban} value={mask(financialResult.data.iban)} ltr /><Info label={t.nationalId} value={mask(financialResult.data.national_id)} ltr /></div> : <Empty text={t.noFinance} />}</Panel> : null}

          {paymentRow.type === "bank_transfer" && canViewFinance ? <Panel title={t.history}>{transactions.length ? <div className="space-y-3">{transactions.map((transaction) => <article key={transaction.id} className="rounded-2xl border border-[#E5E9F5] bg-[#FDFBFE] p-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-lg font-black text-emerald-700">{money.format(num(transaction.amount))}</p><p className="mt-1 text-xs font-bold text-[#8E97AF]">{date.format(new Date(transaction.transferred_at))}</p></div><div className="text-sm font-bold text-[#53618D]"><p>{transaction.transfer_reference}</p><p className="mt-1 text-xs text-[#9B8BA3]">{transaction.finance_batch_number || "—"}</p></div></div>{transaction.proofUrl ? <a href={transaction.proofUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-black text-[#576AC2]">{t.proofLink} ↗</a> : null}</article>)}</div> : <Empty text={t.noTransactions} />}</Panel> : null}
        </div>

        <aside className="space-y-6">
          <Panel title={t.workflow}>
            <div className="space-y-4">
              {paymentRow.status === "draft" && canSubmit ? <form action={submitPaymentForApproval}><input type="hidden" name="payment_id" value={id} /><button className="w-full rounded-2xl bg-[#9463AE] px-4 py-3.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(75,94,184,.22)]">{t.submit}</button></form> : null}
              {paymentRow.status === "awaiting_approval" && canApprove ? <>
                <form action={reviewPayment}><input type="hidden" name="payment_id" value={id} /><input type="hidden" name="decision" value="approve" /><button className="w-full rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-black text-white">{t.approve}</button></form>
                <ReviewForm paymentId={id} decision="return" label={t.return} reasonLabel={t.reason} tone="amber" />
                <ReviewForm paymentId={id} decision="reject" label={t.reject} reasonLabel={t.reason} tone="rose" />
              </> : null}
              {paymentRow.return_reason ? <Notice tone="warning" text={paymentRow.return_reason} /> : null}
              {paymentRow.rejection_reason ? <Notice tone="error" text={paymentRow.rejection_reason} /> : null}
              {paymentRow.status !== "draft" && paymentRow.status !== "awaiting_approval" ? <div className="rounded-2xl bg-[#F6F8FE] p-4 text-sm font-bold leading-7 text-[#6D5B77]">{statusText[paymentRow.status as keyof typeof statusText] ?? paymentRow.status}</div> : null}
            </div>
          </Panel>

          {paymentRow.type === "bank_transfer" && canPay && ["ready_for_finance", "partially_paid"].includes(paymentRow.status) ? <Panel title={t.bankTransfer}><form action={recordBankTransfer} className="space-y-3"><input type="hidden" name="payment_id" value={id} /><Field label={t.amount}><input name="amount" type="number" min="0.01" max={remaining} step="0.01" required defaultValue={remaining || ""} /></Field><Field label={t.transferDate}><input name="transferred_at" type="datetime-local" required /></Field><Field label={t.reference}><input name="transfer_reference" required /></Field><Field label={t.batch}><input name="batch_number" /></Field><Field label={t.sourceBank}><input name="source_bank" /></Field><Field label={t.proof}><input name="proof" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" /></Field><Field label={t.notes}><textarea name="notes" rows={3} /></Field><button className="w-full rounded-2xl bg-[#9463AE] px-4 py-3.5 text-sm font-black text-white">{t.record}</button></form></Panel> : null}

          {["voucher", "product"].includes(paymentRow.type) && canPay && ["ready_for_finance", "partially_paid", "paid"].includes(paymentRow.status) ? <Panel title={t.fulfillment}><form action={updatePaymentFulfillment} className="space-y-3"><input type="hidden" name="payment_id" value={id} /><Field label={t.status}><select name="status" defaultValue={currentFulfillment}>{Object.entries(fulfillmentStates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>{paymentRow.type === "voucher" ? <Field label={t.voucherCode}><input name="code" defaultValue={paymentRow.voucher_code ?? ""} /></Field> : null}<Field label={t.notes}><textarea name="notes" rows={3} defaultValue={paymentRow.finance_notes ?? ""} /></Field><button className="w-full rounded-2xl bg-[#9463AE] px-4 py-3.5 text-sm font-black text-white">{t.update}</button></form></Panel> : null}

          <Panel title={t.settlement}>{assignmentRow.settled_at ? <div className="space-y-3"><Info label={t.settledAt} value={date.format(new Date(assignmentRow.settled_at))} /><Info label={t.blockedUntil} value={assignmentRow.availability_blocked_until ? date.format(new Date(assignmentRow.availability_blocked_until)) : null} /></div> : <Empty text={t.notSettled} />}</Panel>

          {paymentRow.finance_notes ? <Panel title={t.systemNotes}><p className="text-sm font-bold leading-7 text-[#6D5B77]">{paymentRow.finance_notes}</p></Panel> : null}
        </aside>
      </section>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[26px] border border-white/90 bg-white/94 p-5 shadow-[0_18px_55px_rgba(69,83,151,.08)] sm:p-6"><h2 className="mb-5 text-lg font-black text-[#4A315C]">{title}</h2>{children}</section>; }
function HeroMetric({ label, value }: { label: string; value: string }) { return <div className="min-w-28 rounded-2xl bg-white/13 px-4 py-3 text-center ring-1 ring-white/16"><p className="text-[11px] font-bold text-white/65">{label}</p><p className="mt-1 text-base font-black sm:text-lg">{value}</p></div>; }
function Info({ label, value, ltr }: { label: string; value?: string | null; ltr?: boolean }) { return <div><p className="text-xs font-extrabold text-[#96859E]">{label}</p><p dir={ltr ? "ltr" : undefined} className={`mt-1.5 min-h-6 text-sm font-black text-[#503863] ${ltr ? "text-start" : ""}`}>{value || "—"}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#ECE1F1] bg-[#FDFBFE] p-6 text-center text-sm font-bold text-[#95849D]">{text}</div>; }
function Notice({ tone, text }: { tone: "success" | "error" | "warning"; text: string }) { const styles = tone === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-100" : tone === "warning" ? "bg-amber-50 text-amber-800 border-amber-100" : "bg-rose-50 text-rose-800 border-rose-100"; return <div className={`rounded-2xl border p-4 text-sm font-black ${styles}`}>{text}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-black text-[#715F7C]">{label}</span><div className="[&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-[#EEE4F2] [&_input]:bg-[#FDFBFE] [&_input]:px-3 [&_input]:text-sm [&_input]:font-bold [&_input]:text-[#503863] [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-[#EEE4F2] [&_select]:bg-[#FDFBFE] [&_select]:px-3 [&_select]:text-sm [&_select]:font-bold [&_select]:text-[#503863] [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-[#EEE4F2] [&_textarea]:bg-[#FDFBFE] [&_textarea]:p-3 [&_textarea]:text-sm [&_textarea]:font-bold [&_textarea]:text-[#503863]">{children}</div></label>; }
function ReviewForm({ paymentId, decision, label, reasonLabel, tone }: { paymentId: string; decision: "return" | "reject"; label: string; reasonLabel: string; tone: "amber" | "rose" }) { const button = tone === "amber" ? "bg-amber-500 hover:bg-amber-600" : "bg-rose-600 hover:bg-rose-700"; return <form action={reviewPayment} className="rounded-2xl border border-[#E6E9F4] bg-[#FDFBFE] p-3"><input type="hidden" name="payment_id" value={paymentId} /><input type="hidden" name="decision" value={decision} /><textarea name="reason" required rows={2} placeholder={reasonLabel} className="w-full rounded-xl border border-[#EEE4F2] bg-white p-3 text-sm font-bold text-[#503863] outline-none" /><button className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-black text-white transition ${button}`}>{label}</button></form>; }
