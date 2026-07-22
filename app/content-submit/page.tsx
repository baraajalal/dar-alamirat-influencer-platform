"use client";

import { useEffect, useMemo, useState } from "react";

type ExistingContentItem = {
  recordId: string;
  platform: string;
  postLink: string;
  promoCode: string;
  contentType: string;
  contentFileLink: string;
  performanceScreenshotLink: string;
  canReuseInAds: "Yes" | "No" | "";
  usageRightsNote: string;
};

type AssignmentData = {
  recordId: string;
  code: string;
  campaignName: string;
  influencerName: string;
  influencerMobile: string;
  platforms: string[];
  existingItems?: ExistingContentItem[];
};

type ContentItem = {
  platform: string;
  postLink: string;
  promoCode: string;
  contentType: string;
  contentFileLink: string;
  performanceScreenshotLink: string;
  canReuseInAds: "Yes" | "No" | "";
  usageRightsNote: string;
};

const CONTENT_TYPES = [
  "Reel",
  "Story",
  "Post",
  "Snap",
  "TikTok Video",
  "YouTube Short",
  "Photo",
  "Video",
  "Other",
];

function emptyItem(platform: string): ContentItem {
  return {
    platform,
    postLink: "",
    promoCode: "",
    contentType: "",
    contentFileLink: "",
    performanceScreenshotLink: "",
    canReuseInAds: "",
    usageRightsNote: "",
  };
}

function buildItemsFromAssignment(assignment: AssignmentData) {
  const existingItems = assignment.existingItems || [];

  return (assignment.platforms || []).map((platform) => {
    const existing = existingItems.find(
      (item) => item.platform.toLowerCase() === platform.toLowerCase()
    );

    if (!existing) {
      return emptyItem(platform);
    }

    return {
      platform,
      postLink: existing.postLink || "",
      promoCode: existing.promoCode || "",
      contentType: existing.contentType || "",
      contentFileLink: existing.contentFileLink || "",
      performanceScreenshotLink: existing.performanceScreenshotLink || "",
      canReuseInAds: existing.canReuseInAds ||"" as "" | "Yes" | "No",
      usageRightsNote: existing.usageRightsNote || "",
    };
  });
}

export default function ContentSubmitPage() {
  const [code, setCode] = useState("");
  const [assignment, setAssignment] = useState<AssignmentData | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);

  const [coordinatorServiceRating, setCoordinatorServiceRating] = useState<
    number | ""
  >("");
  const [influencerFeedback, setInfluencerFeedback] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [successPopup, setSuccessPopup] = useState<{
    message: string;
  } | null>(null);

  const [isSubmitted, setIsSubmitted] = useState(false);

  const hasAssignment = Boolean(assignment);

  const pageTitle = useMemo(() => {
    if (!assignment) return "رفع محتوى الحملة";
    return `رفع محتوى حملة ${assignment.campaignName || "-"}`;
  }, [assignment]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentCode = params.get("code") || "";

    setCode(currentCode);

    if (!currentCode) {
      setErrorMessage("رابط المحتوى غير مكتمل.");
      setIsLoading(false);
      return;
    }

    fetchAssignment(currentCode);
  }, []);

  async function fetchAssignment(currentCode: string) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(
        `/api/content-submit/assignment?code=${encodeURIComponent(
          currentCode
        )}`,
        {
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || "تعذر جلب بيانات الاتفاق.");
        return;
      }

      const assignmentData = result.assignment as AssignmentData;

      setAssignment(assignmentData);
      setItems(buildItemsFromAssignment(assignmentData));
    } catch {
      setErrorMessage("حدث خطأ أثناء جلب بيانات الاتفاق.");
    } finally {
      setIsLoading(false);
    }
  }

  function updateItem(
    index: number,
    field: keyof ContentItem,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function validateBeforeSubmit() {
    if (!code) {
      return "رابط المحتوى غير مكتمل.";
    }

    if (!items.length) {
      return "لا توجد منصات مرتبطة بهذا الاتفاق.";
    }

    for (const item of items) {
      if (!item.postLink.trim()) {
        return `يرجى إدخال رابط النشر لمنصة ${item.platform}.`;
      }

      if (!item.contentType) {
        return `يرجى اختيار نوع المحتوى لمنصة ${item.platform}.`;
      }

      if (!item.canReuseInAds) {
        return `يرجى تحديد خيار استخدام المحتوى لمنصة ${item.platform}.`;
      }
    }

    if (
      coordinatorServiceRating !== "" &&
      (Number(coordinatorServiceRating) < 1 ||
        Number(coordinatorServiceRating) > 5)
    ) {
      return "تقييم تجربة المنسق يجب أن يكون من 1 إلى 5.";
    }

    return "";
  }

  async function submitContent() {
    const validationMessage = validateBeforeSubmit();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessPopup(null);

      const response = await fetch("/api/content-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          coordinatorServiceRating,
          influencerFeedback,
          items,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(result.message || "تعذر إرسال بيانات المحتوى.");
        return;
      }

      setSuccessPopup({
        message:
          result.message ||
          "تم استلام المحتوى بنجاح. تستغرق عملية مراجعة المحتوى وتقييم أداء الإعلان من 5 إلى 7 أيام. سعدنا بمشاركتكم معنا للوصول إلى أكبر عدد من المستفيدين من الحملة.",
      });

      setIsSubmitted(true);

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrorMessage("حدث خطأ أثناء إرسال بيانات المحتوى.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <main
        dir="rtl"
        className="min-h-screen bg-[#F7F5FA] px-4 py-10 text-[#241D35]"
      >
        <div className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-bold">جاري تحميل بيانات الاتفاق...</p>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-[#F7F5FA] px-4 py-8 text-[#241D35]"
    >
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 rounded-3xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EAFB] text-3xl">
            ✨
          </div>

          <h1 className="text-2xl font-extrabold">{pageTitle}</h1>

          <p className="mt-3 text-sm leading-7 text-[#6B6478]">
            يرجى تعبئة بيانات المحتوى المنشور حسب المنصات المتفق عليها في
            الحملة. سعدنا بالتعاون معكم.
          </p>
        </header>

        {errorMessage && !isSubmitted && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {errorMessage}
          </div>
        )}

        {isSubmitted && !successPopup && (
          <section className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EAFB] text-3xl text-[#6F4EB0]">
              ✓
            </div>

            <h2 className="text-2xl font-extrabold text-[#241D35]">
              تم إرسال المحتوى
            </h2>

            <p className="mt-4 leading-8 text-[#5F5870]">
              شكرًا لكم، تم استلام محتوى الحملة بنجاح.
            </p>

            <p className="mt-2 leading-8 text-[#5F5870]">
              يمكنكم الآن إغلاق الصفحة.
            </p>
          </section>
        )}

        {!hasAssignment && !successPopup && !isSubmitted && (
          <section className="rounded-3xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-extrabold">الرابط غير صحيح</h2>
            <p className="mt-3 text-[#6B6478]">
              لم نتمكن من العثور على بيانات الاتفاق. يرجى التواصل مع منسق
              الحملة.
            </p>
          </section>
        )}

        {hasAssignment && !successPopup && !isSubmitted && (
          <>
            <section className="mb-6 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold">بيانات الحملة</h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-[#F8F5FC] p-4">
                  <p className="text-xs font-bold text-[#8E6CCB]">
                    اسم الحملة
                  </p>
               <p className="mt-1 font-bold">{assignment?.campaignName || "-"}</p>
                </div>

                <div className="rounded-2xl bg-[#F8F5FC] p-4">
                  <p className="text-xs font-bold text-[#8E6CCB]">
                    اسم المؤثر
                  </p>
                  <p className="mt-1 font-bold">{assignment?.influencerName || "-"}</p>
                </div>
              </div>
            </section>

            <section className="space-y-5">
              {items.map((item, index) => (
                <div
                  key={`${item.platform}-${index}`}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-[#8E6CCB]">
                        المنصة المتفق عليها
                      </p>
                      <h3 className="text-xl font-extrabold">
                        {item.platform}
                      </h3>
                    </div>

                    <span className="rounded-full bg-[#F1EAFB] px-4 py-2 text-xs font-bold text-[#6F4EB0]">
                      مطلوب
                    </span>
                  </div>

                  <div className="grid gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        رابط النشر <span className="text-red-500">*</span>
                      </span>
                      <input
                        value={item.postLink}
                        onChange={(event) =>
                          updateItem(index, "postLink", event.target.value)
                        }
                        placeholder="https://..."
                        dir="ltr"
                        className="w-full rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        كود الترويج - اختياري
                      </span>
                      <input
                        value={item.promoCode}
                        onChange={(event) =>
                          updateItem(index, "promoCode", event.target.value)
                        }
                        placeholder="مثال: DAR20"
                        className="w-full rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        نوع المحتوى <span className="text-red-500">*</span>
                      </span>
                      <select
                        value={item.contentType}
                        onChange={(event) =>
                          updateItem(index, "contentType", event.target.value)
                        }
                        className="w-full rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      >
                        <option value="">اختاري نوع المحتوى</option>
                        {CONTENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        رابط المادة الإعلانية عالية الجودة
                      </span>
                      <input
                        value={item.contentFileLink}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "contentFileLink",
                            event.target.value
                          )
                        }
                        placeholder="رابط Google Drive / Dropbox / WeTransfer"
                        dir="ltr"
                        className="w-full rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      />
                      <p className="mt-2 text-xs leading-6 text-[#8B8498]">
                        في هذه النسخة نستخدم رابط ملف عالي الجودة، ورفع الملفات
                        المباشر نضيفه لاحقًا.
                      </p>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        رابط سكرين الأداء أو الترويج - إن وجد
                      </span>
                      <input
                        value={item.performanceScreenshotLink}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "performanceScreenshotLink",
                            event.target.value
                          )
                        }
                        placeholder="رابط صورة أو ملف"
                        dir="ltr"
                        className="w-full rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      />
                    </label>

                    <div>
                      <p className="mb-3 text-sm font-bold">
                        هل توافق/توافقين على استخدام دار الأميرات للمادة
                        الإعلانية؟ <span className="text-red-500">*</span>
                      </p>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, "canReuseInAds", "Yes")
                          }
                          className={`rounded-2xl border px-4 py-3 font-bold transition ${
                            item.canReuseInAds === "Yes"
                              ? "border-[#8E6CCB] bg-[#F1EAFB] text-[#6F4EB0]"
                              : "border-[#E6DFF1] bg-white text-[#6B6478]"
                          }`}
                        >
                          نعم، مسموح
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updateItem(index, "canReuseInAds", "No")
                          }
                          className={`rounded-2xl border px-4 py-3 font-bold transition ${
                            item.canReuseInAds === "No"
                              ? "border-[#8E6CCB] bg-[#F1EAFB] text-[#6F4EB0]"
                              : "border-[#E6DFF1] bg-white text-[#6B6478]"
                          }`}
                        >
                          لا، غير مسموح
                        </button>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold">
                        ملاحظات الاستخدام
                      </span>
                      <textarea
                        value={item.usageRightsNote}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "usageRightsNote",
                            event.target.value
                          )
                        }
                        placeholder="مثال: مسموح استخدام المحتوى لمدة 3 أشهر في حسابات الشركة فقط."
                        rows={3}
                        className="w-full resize-none rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </section>

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold">تقييم تجربة التعاون</h2>

              <div className="mt-5">
                <p className="mb-3 text-sm font-bold">
                  كيف تقيم/تقيمين تجربة التعامل مع منسق الحملة؟
                </p>

                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setCoordinatorServiceRating(rating)}
                      className={`h-12 w-12 rounded-2xl border text-lg font-extrabold transition ${
                        coordinatorServiceRating === rating
                          ? "border-[#8E6CCB] bg-[#8E6CCB] text-white"
                          : "border-[#E6DFF1] bg-white text-[#6B6478]"
                      }`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-bold">
                  ملاحظات إضافية على تجربة التعاون
                </span>
                <textarea
                  value={influencerFeedback}
                  onChange={(event) =>
                    setInfluencerFeedback(event.target.value)
                  }
                  placeholder="اكتبي أي ملاحظات أو اقتراحات..."
                  rows={4}
                  className="w-full resize-none rounded-2xl border border-[#E6DFF1] bg-white px-4 py-3 outline-none focus:border-[#8E6CCB]"
                />
              </label>
            </section>

            <button
              type="button"
              onClick={submitContent}
              disabled={isSaving}
              className="mt-6 w-full rounded-3xl bg-[#8E6CCB] px-6 py-4 text-lg font-extrabold text-white shadow-sm transition hover:bg-[#7C5DBC] disabled:opacity-60"
            >
              {isSaving ? "جاري الإرسال..." : "إرسال بيانات المحتوى"}
            </button>
          </>
        )}
      </div>

      {successPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#F1EAFB] text-3xl text-[#6F4EB0]">
              ✓
            </div>

            <h2 className="text-2xl font-extrabold text-[#241D35]">
              شكرًا لكم
            </h2>

            <p className="mt-4 leading-8 text-[#5F5870]">
              {successPopup.message}
            </p>

            <p className="mt-3 leading-8 text-[#5F5870]">
              نأمل أن تكون خدمتنا قد نالت رضاكم، ونتطلع إلى تعاون مستمر ومثمر
              بإذن الله.
            </p>

            <button
              type="button"
              onClick={() => setSuccessPopup(null)}
              className="mt-6 w-full rounded-2xl bg-[#8E6CCB] px-5 py-3 font-bold text-white transition hover:bg-[#7C5DBC]"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </main>
  );
}