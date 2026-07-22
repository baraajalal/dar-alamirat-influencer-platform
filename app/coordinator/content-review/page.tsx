"use client";

import { useEffect, useMemo, useState } from "react";

type ReviewItem = {
  id: string;
  campaignName: string;
  influencerName: string;
  influencerMobile: string;
  executionType: string;
  platform: string;
  contentType: string;
  promoCode: string;
  postLinks: string[];
  contentLink: string;
  screenshotLink: string;
  usageRightsNote: string;
  canReuseInAds: string;
  approvalStatus: string;
  supervisorNotes: string;
  paymentType: string;
  paymentSummary: string;
  bankAmount: string;
  voucherValue: string;
  productValue: string;
};

type ReviewDecision = "approve" | "needs_changes" | "reject";

type RowDraft = {
  isSuitableForAds: "Yes" | "No";
  supervisorNotes: string;
};

function getPlatformStyle(platform: string) {
  const name = platform.toLowerCase();

  if (name.includes("tiktok")) {
    return { backgroundColor: "#111111", color: "#ffffff" };
  }

  if (name.includes("instagram")) {
    return { backgroundColor: "#C13584", color: "#ffffff" };
  }

  if (name.includes("snapchat")) {
    return { backgroundColor: "#FFFC00", color: "#111111" };
  }

  if (name.includes("youtube")) {
    return { backgroundColor: "#FF0000", color: "#ffffff" };
  }

  if (name === "x") {
    return { backgroundColor: "#000000", color: "#ffffff" };
  }

  if (name.includes("facebook")) {
    return { backgroundColor: "#1877F2", color: "#ffffff" };
  }

  return { backgroundColor: "#3b2b22", color: "#ffffff" };
}

function getExecutionLabel(value: string) {
  if (value === "Home") return "منزلي";
  if (value === "In-Branch") return "حضوري / داخل الفرع";
  return "-";
}

function getPaymentBadgeStyle(paymentType: string) {
  if (paymentType.includes("تحويل")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (paymentType.includes("قسيمة")) {
    return "bg-amber-50 text-amber-800 border-amber-200";
  }

  if (paymentType.includes("منتجات")) {
    return "bg-blue-50 text-blue-800 border-blue-200";
  }

  return "bg-stone-50 text-stone-700 border-stone-200";
}

export default function ContentReviewPage() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [executionTypeFilter, setExecutionTypeFilter] = useState("All");
  const [campaignFilter, setCampaignFilter] = useState("All");

  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});

  async function loadItems() {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/content-review/list", {
        cache: "no-store",
      });

      const text = await response.text();

      let data: any;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text || "حدث خطأ أثناء قراءة رد السيرفر");
      }

      if (!response.ok) {
        throw new Error(data.message || "حدث خطأ أثناء جلب بيانات المراجعة");
      }

      const nextItems = data.items || [];
      setItems(nextItems);

      const drafts: Record<string, RowDraft> = {};

      nextItems.forEach((item: ReviewItem) => {
        drafts[item.id] = {
          isSuitableForAds: "No",
          supervisorNotes: item.supervisorNotes || "",
        };
      });

      setRowDrafts(drafts);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "حدث خطأ أثناء جلب بيانات المراجعة"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const campaigns = useMemo(() => {
    const unique = new Set<string>();

    items.forEach((item) => {
      if (item.campaignName) unique.add(item.campaignName);
    });

    return Array.from(unique);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const executionMatch =
        executionTypeFilter === "All" ||
        item.executionType === executionTypeFilter;

      const campaignMatch =
        campaignFilter === "All" || item.campaignName === campaignFilter;

      return executionMatch && campaignMatch;
    });
  }, [items, executionTypeFilter, campaignFilter]);

  function updateRowDraft(itemId: string, patch: Partial<RowDraft>) {
    setRowDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] || {
          isSuitableForAds: "No",
          supervisorNotes: "",
        }),
        ...patch,
      },
    }));
  }

  async function submitReview(
    item: ReviewItem,
    reviewDecision: ReviewDecision
  ) {
    const draft = rowDrafts[item.id] || {
      isSuitableForAds: "No",
      supervisorNotes: "",
    };

    if (
      (reviewDecision === "needs_changes" || reviewDecision === "reject") &&
      !draft.supervisorNotes.trim()
    ) {
      alert("اكتبي ملاحظات المشرف قبل اختيار يحتاج تعديل أو رفض.");
      return;
    }

    const confirmMessage =
      reviewDecision === "approve"
        ? "هل تريدين اعتماد المحتوى وتجهيزه للدفع؟"
        : reviewDecision === "needs_changes"
        ? "هل تريدين إرجاع المحتوى للتعديل؟"
        : "هل تريدين رفض المحتوى؟";

    const confirmed = window.confirm(confirmMessage);

    if (!confirmed) return;

    try {
      setActionLoadingId(item.id);
      setError("");
      setSuccessMessage("");

      const response = await fetch("/api/content-review/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentRecordId: item.id,
          reviewDecision,
          isSuitableForAds: draft.isSuitableForAds,
          supervisorNotes: draft.supervisorNotes,
        }),
      });

      const text = await response.text();

      let data: any;

      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(text || "حدث خطأ أثناء قراءة رد السيرفر");
      }

      if (!response.ok) {
        throw new Error(data.message || "حدث خطأ أثناء حفظ قرار المراجعة");
      }

      setSuccessMessage(data.message || "تم حفظ قرار المراجعة بنجاح");

      setItems((current) =>
        current.filter((currentItem) => currentItem.id !== item.id)
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء حفظ قرار المراجعة"
      );
    } finally {
      setActionLoadingId("");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] px-5 py-8" dir="rtl">
      <div className="mx-auto max-w-[1350px]">
        <section className="mb-6 rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#3b2b22]">
                مراجعة محتوى المؤثرين
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#7b6657]">
                مراجعة المحتوى، صلاحية الترويج، الجاهزية للدفع، وملاحظات مشرف
                المنسقين.
              </p>
            </div>

            <button
              onClick={loadItems}
              disabled={loading}
              className="rounded-2xl bg-[#3b2b22] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              تحديث البيانات
            </button>
          </div>
        </section>

        <section className="mb-6 grid gap-4 rounded-[28px] border border-[#eadfce] bg-white p-6 shadow-sm md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#3b2b22]">
              فلتر نوع التنفيذ
            </label>
            <select
              value={executionTypeFilter}
              onChange={(event) => setExecutionTypeFilter(event.target.value)}
              className="w-full rounded-2xl border border-[#e5d8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b6f47]"
            >
              <option value="All">كل الأنواع</option>
              <option value="Home">منزلي</option>
              <option value="In-Branch">حضوري / داخل الفرع</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#3b2b22]">
              فلتر الحملة
            </label>
            <select
              value={campaignFilter}
              onChange={(event) => setCampaignFilter(event.target.value)}
              className="w-full rounded-2xl border border-[#e5d8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b6f47]"
            >
              <option value="All">كل الحملات</option>
              {campaigns.map((campaign) => (
                <option key={campaign} value={campaign}>
                  {campaign}
                </option>
              ))}
            </select>
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {successMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center text-[#7b6657] shadow-sm">
            جاري تحميل بيانات المراجعة...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center text-[#7b6657] shadow-sm">
            لا توجد مواد بانتظار المراجعة حاليًا.
          </div>
        ) : (
          <div className="space-y-5">
            {filteredItems.map((item, itemIndex) => {
              const draft = rowDrafts[item.id] || {
                isSuitableForAds: "No",
                supervisorNotes: "",
              };

              const isLoading = actionLoadingId === item.id;

              return (
                <section
                  key={
                    item.id ||
                    `${item.campaignName}-${item.influencerMobile}-${item.platform}-${itemIndex}`
                  }
                  className="overflow-hidden rounded-[30px] border border-[#eadfce] bg-white shadow-sm"
                >
                  <div className="border-b border-[#eadfce] bg-[#fbf7f1] p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#3b2b22] px-3 py-1 text-xs font-semibold text-white">
                            {getExecutionLabel(item.executionType)}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPaymentBadgeStyle(
                              item.paymentType
                            )}`}
                          >
                            {item.paymentType || "-"}
                          </span>

                          {item.promoCode ? (
                            <span className="rounded-full bg-[#efe2cf] px-3 py-1 text-xs font-semibold text-[#5a3d2b]">
                              كود: {item.promoCode}
                            </span>
                          ) : null}
                        </div>

                        <h2 className="text-xl font-bold text-[#3b2b22]">
                          {item.campaignName || "حملة بدون اسم"}
                        </h2>

                        <p className="mt-2 text-sm text-[#7b6657]">
                          {item.influencerName || "-"} —{" "}
                          {item.influencerMobile || "-"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white px-5 py-4 text-sm shadow-sm xl:min-w-[300px]">
                        <div className="text-xs font-semibold text-[#9b8a7a]">
                          المقابل والقيمة
                        </div>
                        <div className="mt-1 font-bold text-[#3b2b22]">
                          {item.paymentSummary || "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-5 xl:grid-cols-[1fr_360px]">
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-[#f0e7db] bg-[#fffaf4] p-4">
                          <div className="text-xs font-semibold text-[#9b8a7a]">
                            المنصة
                          </div>
                          <div className="mt-1 font-bold text-[#3b2b22]">
                            {item.platform || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#f0e7db] bg-[#fffaf4] p-4">
                          <div className="text-xs font-semibold text-[#9b8a7a]">
                            نوع المحتوى
                          </div>
                          <div className="mt-1 font-bold text-[#3b2b22]">
                            {item.contentType || "-"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-[#f0e7db] bg-[#fffaf4] p-4">
                          <div className="text-xs font-semibold text-[#9b8a7a]">
                            موافقة الاستخدام
                          </div>
                          <div className="mt-1 font-bold text-[#3b2b22]">
                            {item.canReuseInAds || "-"}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-[#f0e7db] p-4">
                        <div className="mb-3 text-sm font-bold text-[#3b2b22]">
                          روابط المحتوى
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {item.postLinks?.length ? (
                            item.postLinks.map((link, index) => (
                              <a
                                key={`${item.id || itemIndex}-post-link-${index}`}
                                href={link}
                                target="_blank"
                                rel="noreferrer"
                                style={getPlatformStyle(item.platform)}
                                className="rounded-2xl px-4 py-2 text-sm font-bold shadow-sm transition hover:scale-[1.02]"
                              >
                                رابط النشر {item.postLinks.length > 1 ? index + 1 : ""}
                              </a>
                            ))
                          ) : (
                            <span className="rounded-2xl bg-[#f7f2ea] px-4 py-2 text-sm text-[#9b8a7a]">
                              لا يوجد رابط نشر
                            </span>
                          )}

                          {item.contentLink ? (
                            <a
                              href={item.contentLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl bg-[#efe2cf] px-4 py-2 text-sm font-bold text-[#5a3d2b] transition hover:opacity-80"
                            >
                              رابط المادة
                            </a>
                          ) : null}

                          {item.screenshotLink ? (
                            <a
                              href={item.screenshotLink}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl bg-[#efe2cf] px-4 py-2 text-sm font-bold text-[#5a3d2b] transition hover:opacity-80"
                            >
                              رابط السكرين
                            </a>
                          ) : null}
                        </div>
                      </div>

                      {item.usageRightsNote ? (
                        <div className="rounded-2xl border border-[#f0e7db] bg-[#fffaf4] p-4">
                          <div className="mb-1 text-xs font-semibold text-[#9b8a7a]">
                            ملاحظات استخدام المحتوى
                          </div>
                          <p className="text-sm leading-6 text-[#3b2b22]">
                            {item.usageRightsNote}
                          </p>
                        </div>
                      ) : null}
                    </div>

                    <aside className="rounded-3xl border border-[#eadfce] bg-[#fbf7f1] p-5">
                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-bold text-[#3b2b22]">
                          هل يصلح للترويج؟
                        </label>
                        <select
                          value={draft.isSuitableForAds}
                          onChange={(event) =>
                            updateRowDraft(item.id, {
                              isSuitableForAds: event.target.value as
                                | "Yes"
                                | "No",
                            })
                          }
                          className="w-full rounded-2xl border border-[#e5d8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b6f47]"
                        >
                          <option value="No">لا</option>
                          <option value="Yes">نعم</option>
                        </select>

                        <p className="mt-2 text-xs leading-5 text-[#9b8a7a]">
                          الترويج النهائي يتطلب أن تكون موافقة المؤثر على
                          الاستخدام = Yes.
                        </p>
                      </div>

                      <div className="mb-4">
                        <label className="mb-2 block text-sm font-bold text-[#3b2b22]">
                          ملاحظات المشرف
                        </label>
                        <textarea
                          value={draft.supervisorNotes}
                          onChange={(event) =>
                            updateRowDraft(item.id, {
                              supervisorNotes: event.target.value,
                            })
                          }
                          rows={6}
                          placeholder="اكتبي ملاحظات المراجعة هنا..."
                          className="w-full resize-none rounded-2xl border border-[#e5d8c8] bg-white px-4 py-3 text-sm outline-none focus:border-[#8b6f47]"
                        />
                      </div>

                      <div className="grid gap-3">
                        <button
                          onClick={() => submitReview(item, "approve")}
                          disabled={isLoading}
                          className="rounded-2xl bg-green-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-50"
                        >
                          اعتماد وجاهز للدفع
                        </button>

                        <button
                          onClick={() => submitReview(item, "needs_changes")}
                          disabled={isLoading}
                          className="rounded-2xl bg-amber-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                        >
                          يحتاج تعديل
                        </button>

                        <button
                          onClick={() => submitReview(item, "reject")}
                          disabled={isLoading}
                          className="rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
                        >
                          رفض المحتوى
                        </button>

                        {isLoading ? (
                          <p className="text-center text-xs text-[#7b6657]">
                            جاري حفظ القرار...
                          </p>
                        ) : null}
                      </div>
                    </aside>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}