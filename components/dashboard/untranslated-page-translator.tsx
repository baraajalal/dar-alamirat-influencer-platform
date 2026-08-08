"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { DashboardLocale } from "@/lib/i18n/dashboard";

const EXACT: Record<string, string> = {
  "طلب شخصي": "Personal request",
  "لاستخدام الحملة": "Campaign use",
  "مرتبط بمستحقات مالية": "Linked to financial dues",
  "بانتظار المراجعة": "Awaiting review",
  "تم إرسال الدعوة": "Invitation sent",
  "تم التفعيل": "Activated",
  "مرفوض": "Rejected",
  "ملغي": "Cancelled",
  "ملغاة": "Cancelled",
  "تم إنشاء الحساب وإرسال دعوة التفعيل إلى البريد الإلكتروني.": "The account was created and an activation invitation was sent by email.",
  "الحساب مرتبط مسبقًا وتم إغلاق الطلب.": "The account was already linked and the request was closed.",
  "تم رفض طلب التفعيل.": "The activation request was rejected.",
  "معرف الطلب غير موجود.": "Request ID is missing.",
  "تعذر العثور على طلب التفعيل.": "The activation request could not be found.",
  "هذا الطلب مغلق ولا يمكن معالجته.": "This request is closed and cannot be processed.",
  "ملف المؤثر غير موجود.": "Influencer profile was not found.",
  "البريد مستخدم في حساب آخر. راجعي البريد قبل إعادة الدعوة.": "This email is used by another account. Review it before resending the invitation.",
  "تعذر إرسال دعوة Supabase. راجعي إعدادات البريد وروابط التحويل.": "The Supabase invitation could not be sent. Review email and redirect settings.",
  "تم إلغاء إنشاء الحساب لأن ربطه بملف المؤثر لم يكتمل.": "Account creation was rolled back because linking it to the influencer profile was not completed.",
  "تعذر رفض الطلب.": "The request could not be rejected.",
  "تم تنفيذ العملية.": "The operation was completed.",
  "حدث خطأ غير متوقع.": "An unexpected error occurred.",
  "عالية": "High",
  "عادية": "Normal",

  "مدير النظام": "System Admin",
  "منسق حملات": "Campaign Coordinator",
  "الإدارة المالية": "Finance",
  "مراجع محتوى": "Content Reviewer",
  "مشاهدة فقط": "Read only",
  "تم إنشاء المستخدم وإرسال دعوة التفعيل.": "The user was created and an activation invitation was sent.",
  "تمت إعادة إرسال الدعوة.": "The invitation was resent.",
  "تم تحديث بيانات المستخدم وصلاحيته.": "User details and role were updated.",
  "تم تفعيل المستخدم.": "The user was activated.",
  "تم تعطيل المستخدم.": "The user was disabled.",
  "راجعي الاسم والبريد والدور.": "Review the name, email, and role.",
  "معرف المستخدم غير صحيح.": "Invalid user ID.",
  "البريد مستخدم مسبقًا.": "This email is already in use.",
  "تعذر إرسال الدعوة. راجعي إعدادات Supabase والبريد.": "The invitation could not be sent. Review Supabase and email settings.",
  "تم إلغاء الدعوة لأن إنشاء ملف المستخدم لم يكتمل.": "The invitation was rolled back because the user profile was not completed.",
  "لا يوجد بريد محفوظ لهذا المستخدم.": "No email is saved for this user.",
  "فعّلي المستخدم قبل إعادة إرسال الدعوة.": "Activate the user before resending the invitation.",
  "تعذر إعادة إرسال الدعوة.": "The invitation could not be resent.",
  "تعذر تحديث المستخدم.": "The user could not be updated.",
  "تعذر تغيير حالة المستخدم.": "The user status could not be changed.",
  "لا يمكنك تعطيل حسابك الحالي.": "You cannot disable your current account.",
  "لا يمكنك إزالة صلاحية المدير من حسابك الحالي.": "You cannot remove the admin role from your current account.",
  "معطل": "Disabled",
  "نشط": "Active",
  "دعوة معلقة": "Pending invitation",
  "لم يسجل الدخول": "Never signed in",
  "تعطيل": "Disable",
  "تفعيل": "Activate",
  "آخر دعوة": "Last invitation",

  "بانتظار الدعوة": "Awaiting invitation",
  "مقبول": "Accepted",
  "بانتظار المنتج": "Awaiting product",
  "بانتظار البريف": "Awaiting brief",
  "بانتظار المحتوى": "Awaiting content",
  "تحت المراجعة": "Under review",
  "يحتاج تعديل": "Needs changes",
  "معتمد": "Approved",
  "معتمدة": "Approved",
  "بانتظار الاستحقاق": "Awaiting payment entitlement",
  "تمت التسوية": "Settled",
  "مغلق": "Closed",
  "معتذر": "Declined",
  "ملغى": "Cancelled",
  "مؤثروني": "My influencers",
  "تكليفات نشطة": "Active assignments",
  "دعوات مرسلة": "Invitations sent",
  "مقبولون": "Accepted",
  "عقود مكتملة": "Completed contracts",
  "تكليفات مكتملة": "Completed assignments",
  "متوسط التقدم": "Average progress",
  "إجمالي التكليفات": "Total assignments",
  "تكليفات المؤثرين": "Influencer assignments",
  "المؤثر": "Influencer",
  "الحملة": "Campaign",
  "المنسق": "Coordinator",
  "الحالة": "Status",
  "الدعوة": "Invitation",
  "التقدم": "Progress",
  "الإجراءات": "Actions",
  "غير محدد": "Not assigned",
  "تم الإرسال": "Sent",
  "لم تُرسل": "Not sent",
  "فتح": "Open",
  "إرسال عبر واتساب": "Send via WhatsApp",

  "الاعتمادات المالية": "Financial approvals",
  "اعتماد ملفات البنك ومستحقات الإعلانات وإرجاع الملاحظات للمؤثر.": "Approve bank profiles and ad payments, and return notes to influencers.",
  "التحويلات المالية": "Financial transfers",
  "تجميع المستحقات في مسودات ومراجعتها وتجهيز ملفات البنك والتحويل اليدوي.": "Group dues into drafts, review them, prepare bank files, and record manual transfers.",
  "القسائم الإلكترونية": "Electronic vouchers",
  "إدارة قسائم الفروع والموقع وقسائم الطلبات التابعة للمنسقين.": "Manage branch, website, and coordinator-order vouchers.",
  "التحويلات المرتجعة": "Returned transfers",
  "معالجة رفض البنك وتصحيح البيانات وإعادة التحويل دون حذف المحاولة السابقة.": "Handle bank rejections, correct data, and retry transfers without deleting prior attempts.",
  "تسليم المنتجات": "Product delivery",
  "تجهيز وشحن وتسليم المقابل بالمنتجات مع رقم التتبع وإثبات الاستلام.": "Prepare, ship, and deliver product compensation with tracking and proof of receipt.",
  "التنبيهات والتصعيد": "Alerts and escalation",
  "متابعة التأخير في الاعتماد والتحويل والقسائم والشحن قبل تفاقم المشكلة.": "Track delays in approvals, transfers, vouchers, and shipping before they escalate.",
  "التسويات والمتابعة": "Settlements and follow-up",
  "مطابقة المستحق مع التنفيذ وإقفال التكليفات وبدء حظر الـ45 يومًا.": "Match entitlements to execution, close assignments, and start the 45-day cooldown.",
  "مشكلات تحتاج معالجة": "Issues requiring action",
  "كشف المبالغ الصفرية والبيانات الناقصة والتأخير وعدم تطابق الحالات.": "Detect zero amounts, missing data, delays, and status mismatches.",
  "التقرير المالي العام": "Financial overview report",
  "عرض الموقف المالي والمجموعات الجاهزة والمحولة والمتأخرة.": "View the financial position and ready, transferred, and overdue batches.",
  "ملفات بنك بانتظار المراجعة": "Bank profiles awaiting review",
  "مستحقات تحتاج اعتماد": "Entitlements requiring approval",
  "مسودات تحويل مفتوحة": "Open transfer drafts",
  "قسائم تحتاج إجراء": "Vouchers requiring action",
  "مشكلات مالية مفتوحة": "Open financial issues",
  "تنبيهات متأخرة": "Overdue alerts",

  "مسودة": "Draft",
  "بانتظار مراجعة المسودة": "Awaiting draft review",
  "تم تجهيز الملفات": "Files prepared",
  "مرفوعة للبنك": "Submitted to bank",
  "قيد التنفيذ": "Processing",
  "مكتملة": "Completed",
  "معادة للتعديل": "Returned for changes",
  "معادة": "Returned",
  "مرفوضة": "Rejected",
  "راجعي اسم المجموعة ورقمها والشهر وحددي مستحقًا واحدًا على الأقل.": "Review the batch name, code, and month, and select at least one entitlement.",
  "بعض المستحقات لم تعد جاهزة للتجميع.": "Some entitlements are no longer ready for batching.",
  "رقم المجموعة مستخدم مسبقًا.": "The batch code is already in use.",
  "أحد المستحقات موجود داخل مجموعة أخرى.": "One of the entitlements is already in another batch.",
  "تعذر تنفيذ العملية.": "The operation could not be completed.",
  "اسم المجموعة": "Batch name",
  "رقم المجموعة": "Batch code",
  "الشهر التابع للمجموعة": "Batch month",
  "تاريخ التحويل المتوقع": "Expected transfer date",
  "يدوي": "Manual",
  "ملف البنك": "Bank file",
  "المجموعة": "Batch",
  "الشهر": "Month",
  "الإجمالي": "Total",
  "البنك / يدوي": "Bank / Manual",
  "تحويلات الأسبوع الأول": "First-week transfers",
  "أغسطس 2026": "August 2026",

  "قسائم الفروع": "Branch vouchers",
  "قسائم الموقع": "Website vouchers",
  "قسائم الطلبات": "Order vouchers",
  "بانتظار الاعتماد والترحيل": "Awaiting approval and handoff",
  "قيد تجهيز الكود": "Code being prepared",
  "جاهزة للتوزيع": "Ready for distribution",
  "تم الاستخدام": "Redeemed",
  "تم ترحيل قسائم الموقع المحددة إلى تجهيز القسائم.": "Selected website vouchers were moved to voucher preparation.",
  "تم تحديث القسيمة بنجاح.": "The voucher was updated successfully.",
  "حدد قسيمة موقع واحدة على الأقل.": "Select at least one website voucher.",
  "التجهيز متاح لقسائم الموقع الإلكتروني فقط.": "Preparation is available only for website vouchers.",
  "بيانات القسيمة غير صحيحة.": "Invalid voucher data.",
  "تعذر العثور على القسيمة.": "The voucher could not be found.",
  "أدخل كود القسيمة قبل تحويلها إلى جاهزة أو مرسلة.": "Enter the voucher code before marking it ready or sent.",
  "انتهت صلاحية القسيمة ولا يمكن إرسالها.": "The voucher has expired and cannot be sent.",
  "القيمة": "Value",
  "لا توجد قسائم مطابقة للفلتر.": "No vouchers match the selected filter.",
  "الموقع الإلكتروني": "Website",
  "فتح الإعلان": "Open ad",
  "اكتب صيغة الكود": "Enter voucher code",
  "ملاحظات مختصرة": "Short notes",
  "تبدأ الصلاحية عند تجهيز الكود": "Validity starts when the code is prepared",
  "لا توجد قسائم موقع مرحّلة للتجهيز.": "No website vouchers have been handed off for preparation.",

  "تحتاج معالجة": "Needs action",
  "بانتظار الاعتماد": "Awaiting approval",
  "غير مكتملة": "Incomplete",
  "إجمالي المستحق": "Total entitlement",
  "المنفذ فعليًا": "Actually fulfilled",
  "المتبقي": "Remaining",
  "الكل": "All",
  "وسائل المقابل": "Compensation methods",
  "المستحق": "Entitlement",
  "المنفذ": "Fulfilled",
  "الإقفال": "Closure",
  "مراجعة وإقفال": "Review and close",
  "لا توجد نتائج مطابقة.": "No matching results.",
  "الحظر حتى": "Cooldown until",

  "مبلغ صفر": "Zero amount",
  "بيانات بنكية": "Bank data",
  "دفع زائد": "Overpayment",
  "قسيمة بلا كود": "Voucher without code",
  "قسيمة منتهية": "Expired voucher",
  "تأخر التنفيذ": "Execution delay",
  "عدم تطابق الحالة": "Status mismatch",
  "رقابة استباقية": "Proactive control",
  "كشف تلقائي للمبالغ الصفرية، البيانات البنكية الناقصة، القسائم المتأخرة، الدفع الزائد، وعدم تطابق حالات التنفيذ.": "Automatic detection of zero amounts, missing bank data, overdue vouchers, overpayments, and execution status mismatches.",
  "العودة للقسم المالي": "Back to finance",
  "فتح التسويات": "Open settlements",
  "ملفات البنك": "Bank profiles",
  "لا توجد مشكلات من هذا النوع حاليًا.": "There are currently no issues of this type.",

  "عرض فقط": "Read only",
  "الموقف المالي، المجموعات المعتمدة والمرفوعة للبنك، التحويلات اليدوية، والقسائم.": "Financial position, approved and submitted batches, manual transfers, and vouchers.",
  "إجمالي المدفوع": "Total paid",
  "جاهز للتجميع": "Ready for batching",
  "مجموعات مكتملة": "Completed batches",
  "قيمة القسائم": "Voucher value",
  "مستحقات متأخرة": "Overdue entitlements",
  "عدد المجموعات": "Batch count",
  "الشهر الحالي": "Current month",
  "أداء الفريق المالي": "Finance team performance",
  "الموظف": "Employee",
  "المجموعات المنشأة": "Batches created",
  "المراجعات": "Reviews",
  "التحويلات": "Transfers",
  "قيمة التحويل": "Transfer value",
  "متوسط الإكمال": "Average completion",
  "المجموعات المالية": "Financial batches",
  "آخر مجموعات التحويل": "Latest transfer batches",
  "فتح التحويلات": "Open transfers",
  "العدد": "Count",
  "لا توجد مجموعات تحويل بعد.": "No transfer batches yet.",

  "المسار القادم": "Upcoming module",
  "المشاريع التسويقية": "Marketing projects",
  "سيجمع هذا المسار المشاريع الداخلية ومشاريع الموردين، الخدمات التسويقية، حملات المؤثرين، الفعاليات، المهام والتسليمات، العقود، التكاليف، الفواتير والتحصيل.": "This module will bring together internal and supplier projects, marketing services, influencer campaigns, events, tasks and deliverables, contracts, costs, invoices, and collections.",
  "المشاريع والجهات": "Projects and organizations",
  "الخدمات ونطاق العمل": "Services and scope",
  "المهام والفعاليات": "Tasks and events",
  "العقود والفواتير": "Contracts and invoices",
  "قريبًا": "Coming soon"
};

const PATTERNS: Array<[RegExp, string]> = [
  [/^الحملة\s+(\d+)%$/, "Campaign $1%"],
  [/^متبقي\s+(\d+)\s+يوم$/, "$1 days remaining"],
  [/^المتبقي:\s*(\d+)\s+يوم$/, "$1 days remaining"],
  [/^معلّق منذ\s+(\d+)\s+يوم/, "Pending for $1 days"],
  [/^(\d+(?:\.\d+)?)\s+ساعة$/, "$1 hours"],
];

function translateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return value;
  const exact = EXACT[trimmed];
  if (exact) return value.replace(trimmed, exact);
  for (const [pattern, replacement] of PATTERNS) {
    if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, replacement));
  }
  return value;
}

function translateTree(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  for (const node of nodes) {
    const parent = node.parentElement;
    if (!parent || parent.closest("script,style,textarea,[data-no-auto-translate]") || parent.closest("[dir='ltr']")) continue;
    const translated = translateValue(node.nodeValue ?? "");
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }

  root.querySelectorAll<HTMLElement>("[placeholder],[title],[aria-label]").forEach((element) => {
    for (const attribute of ["placeholder", "title", "aria-label"] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const translated = translateValue(current);
      if (translated !== current) element.setAttribute(attribute, translated);
    }
  });
}

export function UntranslatedPageTranslator({ locale }: { locale: DashboardLocale }) {
  const pathname = usePathname();

  useEffect(() => {
    if (locale !== "en") return;

    // Do not observe and mutate newly streamed React nodes. Doing so can change
    // server-rendered text before React hydrates the next route and causes a
    // hydration mismatch. Translate once only after the route has hydrated.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const root = document.querySelector(".employee-dashboard-content");
        if (root) translateTree(root);
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [locale, pathname]);

  return null;
}
