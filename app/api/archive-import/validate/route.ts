import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type Row = Record<string, string>;

type Issue = {
  sheet: string;
  row: number;
  level: "error" | "warning";
  field?: string;
  message: string;
};

const SHEET_ALIASES = {
  influencers: ["Influencers_01", "01_Influencers"],
  socialAccounts: ["Social_Accounts_02", "02_Social_Accounts"],
  campaigns: ["Campaigns_03", "03_Campaigns"],
  collaborations: ["Campaign_Influencers_04", "04_Campaign_Influencers"],
  content: ["Content_05", "05_Content"],
  payments: ["Payments_06", "06_Payments"],
};

const ALLOWED_PLATFORMS = new Set([
  "Instagram",
  "TikTok",
  "Snapchat",
  "YouTube",
  "X",
  "Facebook",
  "Other",
]);

const ALLOWED_PAYMENT_TYPES = new Set([
  "Bank Transfer",
  "Voucher",
  "Product",
  "Bank Transfer + Voucher",
  "Commission",
  "Other",
]);

const ALLOWED_COLLAB_STATUSES = new Set([
  "Closed",
  "Payment Pending",
  "Published",
  "Rejected",
  "Brief Sent",
  "Product Sent",
]);

const ALLOWED_PAYMENT_APPROVAL = new Set([
  "Pending",
  "Approved",
  "Rejected",
  "Need Review",
]);

const ALLOWED_PAYMENT_STATUS = new Set([
  "Ready for Finance",
  "Paid",
  "Partially Paid",
  "Cancelled",
]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم رفع ملف." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const issues: Issue[] = [];

    const influencersSheet = findSheet(workbook, SHEET_ALIASES.influencers);
    const socialAccountsSheet = findSheet(workbook, SHEET_ALIASES.socialAccounts);
    const campaignsSheet = findSheet(workbook, SHEET_ALIASES.campaigns);
    const collaborationsSheet = findSheet(workbook, SHEET_ALIASES.collaborations);
    const contentSheet = findSheet(workbook, SHEET_ALIASES.content);
    const paymentsSheet = findSheet(workbook, SHEET_ALIASES.payments);

    const requiredChecks = [
      { name: "Influencers", sheet: influencersSheet, aliases: SHEET_ALIASES.influencers },
      { name: "Social Accounts", sheet: socialAccountsSheet, aliases: SHEET_ALIASES.socialAccounts },
      { name: "Campaigns", sheet: campaignsSheet, aliases: SHEET_ALIASES.campaigns },
      { name: "Campaign Influencers", sheet: collaborationsSheet, aliases: SHEET_ALIASES.collaborations },
      { name: "Content", sheet: contentSheet, aliases: SHEET_ALIASES.content },
      { name: "Payments", sheet: paymentsSheet, aliases: SHEET_ALIASES.payments },
    ];

    for (const item of requiredChecks) {
      if (!item.sheet) {
        issues.push({
          sheet: item.aliases.join(" أو "),
          row: 0,
          level: "error",
          message: `الشيت غير موجود. الأسماء المقبولة: ${item.aliases.join(" أو ")}`,
        });
      }
    }

    const influencers = readSmartSheet(workbook, influencersSheet);
    const socialAccounts = readSmartSheet(workbook, socialAccountsSheet);
    const campaigns = readSmartSheet(workbook, campaignsSheet);
    const collaborations = readSmartSheet(workbook, collaborationsSheet);
    const content = readSmartSheet(workbook, contentSheet);
    const payments = readSmartSheet(workbook, paymentsSheet);

    validateInfluencers(influencers.rows, issues);
    validateSocialAccounts(socialAccounts.rows, issues);
    validateCampaigns(campaigns.rows, issues);
    validateCollaborations(collaborations.rows, issues);
    validateContent(content.rows, issues);
    validatePayments(payments.rows, issues);

    const duplicateInfluencers = countDuplicates(
      influencers.rows,
      (row) => normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]))
    );

    const duplicateCollaborations = countDuplicates(collaborations.rows, (row) => {
      const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
      const campaign = normalizeText(get(row, ["Campaign Name"]));
      const publishingDate = normalizeDateKey(get(row, ["Publishing Date", "Post Date"]));
      return `${mobile}|${campaign}|${publishingDate}`;
    });

    const errors = issues.filter((issue) => issue.level === "error").length;
    const warnings = issues.filter((issue) => issue.level === "warning").length;

    return NextResponse.json({
      ok: true,
      summary: {
        influencers: influencers.rows.length,
        socialAccounts: socialAccounts.rows.length,
        campaigns: campaigns.rows.length,
        collaborations: collaborations.rows.length,
        content: content.rows.length,
        payments: payments.rows.length,
        errors,
        warnings,
        duplicateCollaborations,
        duplicateInfluencers,
        readyToImport: errors === 0,
      },
      debug: {
        workbookSheets: workbook.SheetNames,
        detectedHeaders: {
          influencers: influencers.headers,
          socialAccounts: socialAccounts.headers,
          campaigns: campaigns.headers,
          collaborations: collaborations.headers,
          content: content.headers,
          payments: payments.headers,
        },
      },
      issues,
    });
  } catch (error) {
    console.error("Archive validation error:", error);

    return NextResponse.json(
      { error: "حدث خطأ أثناء قراءة ملف الأرشيف." },
      { status: 500 }
    );
  }
}

function findSheet(workbook: XLSX.WorkBook, possibleNames: string[]): string | null {
  const normalizedNames = workbook.SheetNames.map((name) => ({
    original: name,
    normalized: normalizeHeader(name),
  }));

  for (const possible of possibleNames) {
    const found = normalizedNames.find(
      (item) => item.normalized === normalizeHeader(possible)
    );

    if (found) return found.original;
  }

  return null;
}

function readSmartSheet(
  workbook: XLSX.WorkBook,
  sheetName: string | null
): { rows: Row[]; headers: string[] } {
  if (!sheetName) return { rows: [], headers: [] };

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], headers: [] };

  const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) return { rows: [], headers: [] };

  const headerRowIndex = findHeaderRowIndex(matrix);

  if (headerRowIndex === -1) {
    return { rows: [], headers: [] };
  }

  const headers = matrix[headerRowIndex].map((cell) => cleanText(cell));

  const rows: Row[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];

    const hasAnyValue = line.some((cell) => cleanText(cell) !== "");
    if (!hasAnyValue) continue;

    const row: Row = {};

    headers.forEach((header, index) => {
      if (!header) return;
      row[header] = cleanText(line[index]);
    });

    row.__excelRowNumber = String(i + 1);

    rows.push(row);
  }

  return { rows, headers };
}

function findHeaderRowIndex(matrix: any[][]): number {
  const knownHeaders = [
    "Influencer Mobile",
    "Influencer Name",
    "Campaign Name",
    "Payment Type",
    "Collaboration Status",
    "Payment Approval Status",
    "Platform",
    "Post Link",
    "Payment Status",
  ];

  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(matrix.length, 20); i++) {
    const row = matrix[i] || [];
    const normalizedCells = row.map((cell) => normalizeHeader(cleanText(cell)));

    let score = 0;

    for (const header of knownHeaders) {
      if (normalizedCells.includes(normalizeHeader(header))) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestScore >= 2 ? bestIndex : 0;
}

function cleanText(input: any): string {
  return String(input ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(input: string): string {
  return cleanText(input)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeText(input: string): string {
  return cleanText(input).toLowerCase();
}

function get(row: Row, possibleKeys: string[]): string {
  for (const key of possibleKeys) {
    const direct = row[key];

    if (direct !== undefined && direct !== null && cleanText(direct) !== "") {
      return cleanText(direct);
    }
  }

  for (const [actualKey, actualValue] of Object.entries(row)) {
    for (const expectedKey of possibleKeys) {
      if (normalizeHeader(actualKey) === normalizeHeader(expectedKey)) {
        return cleanText(actualValue);
      }
    }
  }

  return "";
}

function has(row: Row, possibleKeys: string[]): boolean {
  return get(row, possibleKeys) !== "";
}

function rowNumber(row: Row, fallbackIndex: number): number {
  const excelRowNumber = Number(row.__excelRowNumber);
  return Number.isFinite(excelRowNumber) && excelRowNumber > 0
    ? excelRowNumber
    : fallbackIndex + 2;
}

function normalizePhone(input: string): string {
  const text = cleanText(input).replace(/[^\d+]/g, "");

  if (!text) return "";

  return text
    .replace(/^00966/, "966")
    .replace(/^\+966/, "966")
    .replace(/^0/, "966");
}

function normalizeDateKey(input: string): string {
  return cleanText(input);
}

function isValidUrlOrEmpty(input: string): boolean {
  const text = cleanText(input);
  if (!text) return true;
  return text.startsWith("http://") || text.startsWith("https://");
}

function looksLikeIban(input: string): boolean {
  const text = cleanText(input).replace(/\s+/g, "").toUpperCase();
  if (!text) return false;
  return /^SA\d{22}$/.test(text);
}

function addIssue(
  issues: Issue[],
  sheet: string,
  row: number,
  level: "error" | "warning",
  field: string,
  message: string
) {
  issues.push({
    sheet,
    row,
    level,
    field,
    message,
  });
}

function countDuplicates(rows: Row[], getKey: (row: Row) => string): number {
  const seen = new Map<string, number>();
  let duplicates = 0;

  for (const row of rows) {
    const key = getKey(row);
    if (!key || key.includes("||")) continue;

    const current = seen.get(key) || 0;
    seen.set(key, current + 1);

    if (current === 1) duplicates += 1;
  }

  return duplicates;
}

function validateInfluencers(rows: Row[], issues: Issue[]) {
  const sheet = "Influencers_01";
  const seenPhones = new Set<string>();

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);
    const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));

    if (!mobile) {
      addIssue(issues, sheet, rn, "error", "Influencer Mobile", "رقم الجوال مطلوب.");
    }

    if (!has(row, ["Influencer Name", "Full Name"])) {
      addIssue(issues, sheet, rn, "warning", "Influencer Name", "اسم المؤثر غير موجود.");
    }

    if (!has(row, ["Record Source"])) {
      addIssue(issues, sheet, rn, "warning", "Record Source", "يفضل وضع Record Source = Archive.");
    }

    if (mobile) {
      if (seenPhones.has(mobile)) {
        addIssue(issues, sheet, rn, "warning", "Influencer Mobile", "رقم الجوال مكرر داخل شيت المؤثرين.");
      }

      seenPhones.add(mobile);
    }

    const iban = get(row, ["IBAN"]);
    if (iban && !looksLikeIban(iban)) {
      addIssue(
        issues,
        sheet,
        rn,
        "warning",
        "IBAN",
        "صيغة الآيبان لا تبدو صحيحة. يجب أن تبدأ بـ SA وتتكون من 24 خانة."
      );
    }
  });
}

function validateSocialAccounts(rows: Row[], issues: Issue[]) {
  const sheet = "Social_Accounts_02";
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);
    const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
    const platform = get(row, ["Platform"]);

    if (!mobile) {
      addIssue(issues, sheet, rn, "error", "Influencer Mobile", "رقم الجوال مطلوب.");
    }

    if (!platform) {
      addIssue(issues, sheet, rn, "error", "Platform", "المنصة مطلوبة.");
    } else if (!ALLOWED_PLATFORMS.has(platform)) {
      addIssue(issues, sheet, rn, "error", "Platform", `المنصة غير معتمدة: ${platform}`);
    }

    const profileUrl = get(row, ["Profile URL"]);
    if (!isValidUrlOrEmpty(profileUrl)) {
      addIssue(issues, sheet, rn, "warning", "Profile URL", "الرابط لا يبدأ بـ https:// أو http://");
    }

    const key = `${mobile}|${platform}`;
    if (mobile && platform) {
      if (seen.has(key)) {
        addIssue(issues, sheet, rn, "warning", "Platform", "نفس المؤثر لديه نفس المنصة أكثر من مرة.");
      }

      seen.add(key);
    }
  });
}

function validateCampaigns(rows: Row[], issues: Issue[]) {
  const sheet = "Campaigns_03";
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);
    const campaignName = normalizeText(get(row, ["Campaign Name"]));
    const archiveMonth = normalizeText(get(row, ["Archive Month"]));
    const archiveYear = normalizeText(get(row, ["Archive Year"]));
    const key = `${campaignName}|${archiveMonth}|${archiveYear}`;

    if (!campaignName) {
      addIssue(issues, sheet, rn, "error", "Campaign Name", "اسم الحملة مطلوب.");
    }

    if (!has(row, ["Record Source"])) {
      addIssue(issues, sheet, rn, "warning", "Record Source", "يفضل وضع Record Source = Archive.");
    }

    if (campaignName && seen.has(key)) {
      addIssue(issues, sheet, rn, "warning", "Campaign Name", "الحملة مكررة داخل نفس الشهر/السنة.");
    }

    if (campaignName) seen.add(key);
  });
}

function validateCollaborations(rows: Row[], issues: Issue[]) {
  const sheet = "Campaign_Influencers_04";
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);

    const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
    const campaignName = get(row, ["Campaign Name"]);
    const paymentType = get(row, ["Payment Type"]);
    const status = get(row, ["Collaboration Status"]);
    const paymentApproval = get(row, ["Payment Approval Status"]);
    const publishingDate = get(row, ["Publishing Date", "Post Date"]);

    if (!mobile) {
      addIssue(issues, sheet, rn, "error", "Influencer Mobile", "رقم الجوال مطلوب.");
    }

    if (!campaignName) {
      addIssue(issues, sheet, rn, "error", "Campaign Name", "اسم الحملة مطلوب.");
    }

    if (!paymentType) {
      addIssue(issues, sheet, rn, "error", "Payment Type", "نوع الدفع مطلوب.");
    } else if (!ALLOWED_PAYMENT_TYPES.has(paymentType)) {
      addIssue(issues, sheet, rn, "error", "Payment Type", `نوع الدفع غير معتمد: ${paymentType}`);
    }

    if (!status) {
      addIssue(issues, sheet, rn, "error", "Collaboration Status", "حالة التعاون مطلوبة.");
    } else if (!ALLOWED_COLLAB_STATUSES.has(status)) {
      addIssue(issues, sheet, rn, "error", "Collaboration Status", `حالة التعاون غير معتمدة: ${status}`);
    }

    if (paymentApproval && !ALLOWED_PAYMENT_APPROVAL.has(paymentApproval)) {
      addIssue(
        issues,
        sheet,
        rn,
        "error",
        "Payment Approval Status",
        `حالة اعتماد الدفع غير معتمدة: ${paymentApproval}`
      );
    }

    if (["Closed", "Payment Pending", "Published"].includes(status) && !publishingDate) {
      addIssue(
        issues,
        sheet,
        rn,
        "error",
        "Publishing Date",
        "تاريخ النشر مطلوب للحالات المنشورة أو المغلقة أو المعلقة للدفع."
      );
    }

    if (paymentType === "Bank Transfer" && !has(row, ["Agreed Amount"])) {
      addIssue(
        issues,
        sheet,
        rn,
        "error",
        "Agreed Amount",
        "مبلغ التحويل مطلوب إذا كان نوع الدفع Bank Transfer."
      );
    }

    if (paymentType === "Voucher" && !has(row, ["Voucher Value"])) {
      addIssue(
        issues,
        sheet,
        rn,
        "error",
        "Voucher Value",
        "قيمة القسيمة مطلوبة إذا كان نوع الدفع Voucher."
      );
    }

    const publishedLink = get(row, ["Published Link", "Post Link"]);
    if (!isValidUrlOrEmpty(publishedLink)) {
      addIssue(issues, sheet, rn, "warning", "Published Link", "رابط النشر لا يبدأ بـ https:// أو http://");
    }

    const key = `${mobile}|${normalizeText(campaignName)}|${normalizeDateKey(publishingDate)}`;

    if (mobile && campaignName && publishingDate) {
      if (seen.has(key)) {
        addIssue(
          issues,
          sheet,
          rn,
          "error",
          "Duplicate",
          "هذا التعاون مكرر داخل الملف بنفس الجوال والحملة وتاريخ النشر."
        );
      }

      seen.add(key);
    }
  });
}

function validateContent(rows: Row[], issues: Issue[]) {
  const sheet = "Content_05";

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);

    const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
    const campaignName = get(row, ["Campaign Name"]);
    const platform = get(row, ["Platform"]);
    const postLink = get(row, ["Post Link", "Published Link"]);
    const postDate = get(row, ["Post Date", "Publishing Date"]);

    if (!mobile) {
      addIssue(issues, sheet, rn, "error", "Influencer Mobile", "رقم الجوال مطلوب.");
    }

    if (!campaignName) {
      addIssue(issues, sheet, rn, "error", "Campaign Name", "اسم الحملة مطلوب.");
    }

    if (!platform) {
      addIssue(issues, sheet, rn, "error", "Platform", "المنصة مطلوبة.");
    } else if (!ALLOWED_PLATFORMS.has(platform)) {
      addIssue(issues, sheet, rn, "error", "Platform", `المنصة غير معتمدة: ${platform}`);
    }

    if (!postLink) {
      addIssue(issues, sheet, rn, "warning", "Post Link", "رابط المنشور غير موجود.");
    } else if (!isValidUrlOrEmpty(postLink)) {
      addIssue(issues, sheet, rn, "warning", "Post Link", "رابط المنشور لا يبدأ بـ https:// أو http://");
    }

    if (!postDate) {
      addIssue(issues, sheet, rn, "warning", "Post Date", "تاريخ المنشور غير موجود.");
    }
  });
}

function validatePayments(rows: Row[], issues: Issue[]) {
  const sheet = "Payments_06";
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    const rn = rowNumber(row, index);

    const mobile = normalizePhone(get(row, ["Influencer Mobile", "Mobile", "Phone"]));
    const campaignName = get(row, ["Campaign Name"]);
    const paymentType = get(row, ["Payment Type"]);
    const paymentStatus = get(row, ["Payment Status"]);
    const agreedAmount = get(row, ["Agreed Amount"]);
    const voucherValue = get(row, ["Voucher Value"]);
    const iban = get(row, ["IBAN"]);

    if (!mobile) {
      addIssue(issues, sheet, rn, "error", "Influencer Mobile", "رقم الجوال مطلوب.");
    }

    if (!campaignName) {
      addIssue(issues, sheet, rn, "error", "Campaign Name", "اسم الحملة مطلوب.");
    }

    if (!paymentType) {
      addIssue(issues, sheet, rn, "error", "Payment Type", "نوع الدفع مطلوب.");
    } else if (!ALLOWED_PAYMENT_TYPES.has(paymentType)) {
      addIssue(issues, sheet, rn, "error", "Payment Type", `نوع الدفع غير معتمد: ${paymentType}`);
    }

    if (!paymentStatus) {
      addIssue(issues, sheet, rn, "error", "Payment Status", "حالة الدفع مطلوبة.");
    } else if (!ALLOWED_PAYMENT_STATUS.has(paymentStatus)) {
      addIssue(issues, sheet, rn, "error", "Payment Status", `حالة الدفع غير معتمدة: ${paymentStatus}`);
    }

    if (paymentType === "Product") {
      addIssue(issues, sheet, rn, "warning", "Payment Type", "لا يفضل إنشاء سجل Payments إذا كان المقابل Product فقط.");
    }

    if (paymentType === "Bank Transfer") {
      if (!agreedAmount) {
        addIssue(issues, sheet, rn, "error", "Agreed Amount", "مبلغ التحويل مطلوب.");
      }

      if (!has(row, ["Bank Name"])) {
        addIssue(issues, sheet, rn, "error", "Bank Name", "اسم البنك مطلوب للتحويل البنكي.");
      }

      if (!iban) {
        addIssue(issues, sheet, rn, "error", "IBAN", "IBAN مطلوب للتحويل البنكي.");
      } else if (!looksLikeIban(iban)) {
        addIssue(issues, sheet, rn, "warning", "IBAN", "صيغة IBAN غير مؤكدة.");
      }

      if (!has(row, ["Account Holder Name"])) {
        addIssue(issues, sheet, rn, "error", "Account Holder Name", "اسم صاحب الحساب مطلوب.");
      }

      if (!has(row, ["National ID / Iqama", "National ID"])) {
        addIssue(issues, sheet, rn, "error", "National ID / Iqama", "رقم الهوية أو الإقامة مطلوب للتحويل البنكي.");
      }
    }

    if (paymentType === "Voucher" && !voucherValue) {
      addIssue(issues, sheet, rn, "error", "Voucher Value", "قيمة القسيمة مطلوبة.");
    }

    if (paymentStatus === "Paid" && !has(row, ["Paid Date"])) {
      addIssue(issues, sheet, rn, "error", "Paid Date", "تاريخ الدفع مطلوب إذا كانت الحالة Paid.");
    }

    const key = `${mobile}|${normalizeText(campaignName)}|${paymentType}|${agreedAmount}|${voucherValue}`;

    if (mobile && campaignName && paymentType) {
      if (seen.has(key)) {
        addIssue(issues, sheet, rn, "error", "Duplicate", "سجل الدفع مكرر داخل الملف.");
      }

      seen.add(key);
    }
  });
}