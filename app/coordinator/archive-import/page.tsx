"use client";

import { useState } from "react";

type Issue = {
  sheet: string;
  row: number;
  level: "error" | "warning";
  field?: string;
  message: string;
};

type Summary = {
  influencers: number;
  socialAccounts: number;
  campaigns: number;
  collaborations: number;
  content: number;
  payments: number;
  errors: number;
  warnings: number;
  duplicateCollaborations: number;
  duplicateInfluencers: number;
  readyToImport: boolean;
};

type ValidateResponse = {
  ok: boolean;
  summary: Summary;
  issues: Issue[];
  debug?: {
    workbookSheets?: string[];
    detectedHeaders?: Record<string, string[]>;
  };
};

export default function ArchiveImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidateResponse | null>(null);
  const [message, setMessage] = useState("");
  const [archiveYear, setArchiveYear] = useState("2026");
  const [archiveMonth, setArchiveMonth] = useState("May");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [startStep, setStartStep] = useState("influencers");
  async function handleValidate() {
    if (!file) {
      setMessage("اختاري ملف Excel أولًا.");
      return;
    }

    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/archive-import/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "حدث خطأ أثناء فحص الملف.");
        return;
      }

      setResult(data);
    } catch (error) {
      console.error(error);
      setMessage("تعذر فحص الملف. راجعي الاتصال أو صيغة الملف.");
    } finally {
      setLoading(false);
    }
  }
async function handleImport() {
  if (!file) {
    setMessage("اختاري ملف Excel أولًا.");
    return;
  }

  if (!result || !result.summary.readyToImport) {
    setMessage("لا يمكن الاستيراد قبل أن يكون الفحص بدون أخطاء.");
    return;
  }

  const confirmed = window.confirm(
    `سيتم استيراد أرشيف ${archiveMonth} ${archiveYear} إلى SmartSuite. هل أنتِ متأكدة؟`
  );

  if (!confirmed) return;

  setImporting(true);
  setMessage("");
  setImportResult(null);

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("archiveYear", archiveYear);
    formData.append("archiveMonth", archiveMonth);
    formData.append("startStep", startStep);

    const res = await fetch("/api/archive-import/import", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data?.error || "حدث خطأ أثناء الاستيراد.");
      setImportResult(data);
      return;
    }

    setImportResult(data);
  } catch (error) {
    console.error(error);
    setMessage("تعذر تنفيذ الاستيراد.");
  } finally {
    setImporting(false);
  }
}
  return (
    <main dir="inherit" className="min-h-screen bg-[#f7f1ea] px-4 py-8 text-[#2b2118]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm text-[#8a6f5a]">دار الأميرات</p>
          <h1 className="mt-2 text-3xl font-bold">استيراد الأرشيف</h1>
          <p className="mt-3 text-sm leading-7 text-[#786681]">
            ارفعي ملف Excel للأرشيف. هذه الصفحة تفحص الملف فقط ولا تدخل أي بيانات في SmartSuite.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <label className="block text-sm font-semibold">ملف Excel</label>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setMessage("");
            }}
            className="mt-3 block w-full rounded-2xl border border-[#E3D3EA] bg-white px-4 py-3 text-sm"
          />

          <button
            type="button"
            onClick={handleValidate}
            disabled={loading}
            className="mt-5 rounded-2xl bg-[#6f4e37] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "جاري الفحص..." : "فحص الملف Dry Run"}
          </button>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
  <div>
    <label className="block text-sm font-semibold">Archive Year</label>
    <input
      value={archiveYear}
      onChange={(e) => setArchiveYear(e.target.value)}
      className="mt-2 block w-full rounded-2xl border border-[#E3D3EA] bg-white px-4 py-3 text-sm"
      placeholder="2026"
    />
  </div>

  <div>
    <label className="block text-sm font-semibold">Archive Month</label>
    <select
      value={archiveMonth}
      onChange={(e) => setArchiveMonth(e.target.value)}
      className="mt-2 block w-full rounded-2xl border border-[#E3D3EA] bg-white px-4 py-3 text-sm"
    >
      <option value="January">January</option>
      <option value="February">February</option>
      <option value="March">March</option>
      <option value="April">April</option>
      <option value="May">May</option>
      <option value="June">June</option>
      <option value="July">July</option>
      <option value="August">August</option>
      <option value="September">September</option>
      <option value="October">October</option>
      <option value="November">November</option>
      <option value="December">December</option>
    </select>
  </div>
</div>
<div className="mt-6">
  <label className="block text-sm font-semibold">ابدأ الاستيراد من مرحلة</label>
  <select
    value={startStep}
    onChange={(e) => setStartStep(e.target.value)}
    className="mt-2 block w-full rounded-2xl border border-[#E3D3EA] bg-white px-4 py-3 text-sm"
  >
    <option value="influencers">1. Influencers</option>
    <option value="campaigns">2. Campaigns</option>
    <option value="socialAccounts">3. Social Accounts</option>
    <option value="collaborations">4. Campaign Influencers</option>
    <option value="content">5. Content</option>
    <option value="payments">6. Payments</option>
  </select>

  <p className="mt-2 text-xs text-[#8a6f5a]">
    إذا توقف الاستيراد في المنتصف، اختاري المرحلة التي توقف عندها بدل البدء من البداية.
  </p>
</div>
<button
  type="button"
  onClick={handleImport}
  disabled={importing || !result?.summary.readyToImport}
  className="mt-5 rounded-2xl bg-green-700 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
>
  {importing ? "جاري الاستيراد..." : "Import to SmartSuite"}
</button>

          {message && (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {message}
            </div>
          )}
        </div>

        {result && (
          <div className="mt-6 space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">نتيجة الفحص</h2>
                  <p className="mt-1 text-sm text-[#786681]">
                    {result.summary.readyToImport
                      ? "الملف جاهز مبدئيًا للاستيراد."
                      : "الملف يحتاج تعديل قبل الاستيراد."}
                  </p>
                </div>

                <span
                  className={`rounded-full px-4 py-2 text-sm font-semibold ${
                    result.summary.readyToImport
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {result.summary.readyToImport ? "جاهز" : "غير جاهز"}
                </span>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <SummaryCard label="المؤثرين" value={result.summary.influencers} />
                <SummaryCard label="الحسابات الاجتماعية" value={result.summary.socialAccounts} />
                <SummaryCard label="الحملات" value={result.summary.campaigns} />
                <SummaryCard label="التعاونات" value={result.summary.collaborations} />
                <SummaryCard label="المحتوى" value={result.summary.content} />
                <SummaryCard label="المدفوعات" value={result.summary.payments} />
                <SummaryCard label="الأخطاء" value={result.summary.errors} danger />
                <SummaryCard label="التحذيرات" value={result.summary.warnings} warning />
                <SummaryCard label="تكرار التعاونات" value={result.summary.duplicateCollaborations} warning />
                <SummaryCard label="تكرار المؤثرين" value={result.summary.duplicateInfluencers} warning />
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold">الأخطاء والتحذيرات</h2>

              {result.issues.length === 0 ? (
                <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-700">
                  لا توجد أخطاء أو تحذيرات.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-[#f7f1ea] text-right">
                        <th className="p-3">النوع</th>
                        <th className="p-3">الشيت</th>
                        <th className="p-3">الصف</th>
                        <th className="p-3">الحقل</th>
                        <th className="p-3">الملاحظة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.issues.map((issue, index) => (
                        <tr key={`${issue.sheet}-${issue.row}-${issue.field || "field"}-${index}`} className="border-b">
                          <td className="p-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                issue.level === "error"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {issue.level === "error" ? "خطأ" : "تحذير"}
                            </span>
                          </td>
                          <td className="p-3">{issue.sheet}</td>
                          <td className="p-3">{issue.row}</td>
                          <td className="p-3">{issue.field || "-"}</td>
                          <td className="p-3">{issue.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
           </div>
              )}
            </div>
          </div>
        )}
        {importResult && (
  <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">نتيجة الاستيراد</h2>

    <div className="mt-4 grid gap-4 md:grid-cols-3">
      <SummaryCard label="مؤثرين تم إنشاؤهم" value={importResult.created?.influencers || 0} />
      <SummaryCard label="مؤثرين موجودين" value={importResult.existing?.influencers || 0} />
      <SummaryCard label="حملات تم إنشاؤها" value={importResult.created?.campaigns || 0} />
      <SummaryCard label="تعاونات تم إنشاؤها" value={importResult.created?.collaborations || 0} />
      <SummaryCard label="محتوى تم إنشاؤه" value={importResult.created?.content || 0} />
      <SummaryCard label="مدفوعات تم إنشاؤها" value={importResult.created?.payments || 0} />
      <SummaryCard label="تم تخطيه كمكرر" value={importResult.skipped?.duplicates || 0} warning />
      <SummaryCard label="أخطاء الاستيراد" value={importResult.errors?.length || 0} danger />
    </div>

    {importResult.errors?.length > 0 && (
      <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">أخطاء أثناء الاستيراد:</p>
        <pre dir="ltr" className="mt-2 overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(importResult.errors, null, 2)}
        </pre>
      </div>
    )}
  </div>
)}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  danger,
  warning,
}: {
  label: string;
  value: number;
  danger?: boolean;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border p-5 ${
        danger
          ? "border-red-200 bg-red-50"
          : warning
          ? "border-yellow-200 bg-yellow-50"
          : "border-[#eadccd] bg-[#fbf8f5]"
      }`}
    >
      <p className="text-sm text-[#786681]">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}