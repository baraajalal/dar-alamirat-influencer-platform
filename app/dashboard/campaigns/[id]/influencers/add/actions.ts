"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/require-user";

export type AssignmentActionState = {
  ok: boolean;
  message: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
};

const deliverableSchema = z.object({
  contentType: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(50),
});

const platformSchema = z.object({
  socialAccountId: z.string().uuid(),
  deliverables: z.array(deliverableSchema).max(20),
});

const compensationSchema = z.object({
  type: z.enum(["bank_transfer", "voucher", "product"]),
  amount: z.number().finite().min(0),
  expectedPaymentAt: z.string().trim().optional().default(""),
  notes: z.string().trim().max(3000).optional().default(""),
  voucherSource: z.enum(["", "website", "branch"]).optional().default(""),
  voucherBranch: z.string().trim().max(180).optional().default(""),
  productDescription: z.string().trim().max(3000).optional().default(""),
  productReferenceValue: z.number().finite().min(0).optional().default(0),
});

const assignmentSchema = z
  .object({
    campaignId: z.string().uuid(),
    influencerId: z.string().uuid("اختاري مؤثرًا أولًا"),
    executionType: z.enum(["home", "in_branch", "remote"]),
    otherExecutionDetails: z.string().trim().max(3000).optional().default(""),
    requiresContent: z.boolean(),
    contentDueAtIso: z.string().trim().optional().default(""),
    publishingDate: z.string().trim().optional().default(""),
    branchName: z.string().trim().max(180).optional().default(""),
    attendanceAtIso: z.string().trim().optional().default(""),
    orderNumber: z.string().trim().max(180).optional().default(""),
    orderInvoiceAmount: z.string().trim().optional().default(""),
    orderNotes: z.string().trim().max(3000).optional().default(""),
    hasContract: z.boolean(),
    contractReference: z.string().trim().max(180).optional().default(""),
    agreementDate: z.string().trim().optional().default(""),
    paymentTiming: z
      .enum(["", "before_publish", "after_publish", "by_agreement"])
      .optional()
      .default(""),
    contractNotes: z.string().trim().max(3000).optional().default(""),
    coordinatorNotes: z.string().trim().max(5000).optional().default(""),
    currency: z.string().trim().max(8).optional().default("SAR"),
    platformsJson: z.string().min(2),
    compensationsJson: z.string().min(2),
  })
  .superRefine((value, context) => {
    let platforms: z.infer<typeof platformSchema>[] = [];
    let compensations: z.infer<typeof compensationSchema>[] = [];

    try {
      const parsedPlatforms = JSON.parse(value.platformsJson);
      const result = z.array(platformSchema).min(1).safeParse(parsedPlatforms);
      if (!result.success) {
        context.addIssue({
          code: "custom",
          path: ["platformsJson"],
          message: "اختاري حساب تواصل واحدًا على الأقل.",
        });
      } else {
        platforms = result.data;
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["platformsJson"],
        message: "بيانات حسابات التواصل غير صحيحة.",
      });
    }

    if (
      value.requiresContent &&
      platforms.some((platform) => platform.deliverables.length === 0)
    ) {
      context.addIssue({
        code: "custom",
        path: ["platformsJson"],
        message: "حددي نوع محتوى واحدًا على الأقل لكل منصة مختارة.",
      });
    }

    try {
      const parsedCompensations = JSON.parse(value.compensationsJson);
      const result = z.array(compensationSchema).max(3).safeParse(parsedCompensations);
      if (!result.success) {
        context.addIssue({
          code: "custom",
          path: ["compensationsJson"],
          message: "راجعي خيارات المقابل وقيمها.",
        });
      } else {
        compensations = result.data;
      }
    } catch {
      context.addIssue({
        code: "custom",
        path: ["compensationsJson"],
        message: "بيانات المقابل غير صحيحة.",
      });
    }

    const uniqueTypes = new Set(compensations.map((item) => item.type));
    if (uniqueTypes.size !== compensations.length) {
      context.addIssue({
        code: "custom",
        path: ["compensationsJson"],
        message: "لا يمكن تكرار نوع المقابل نفسه.",
      });
    }

    for (const compensation of compensations) {
      if (
        (compensation.type === "bank_transfer" ||
          compensation.type === "voucher") &&
        compensation.amount <= 0
      ) {
        context.addIssue({
          code: "custom",
          path: ["compensationsJson"],
          message: "أدخلي مبلغًا أكبر من صفر للتحويل أو القسيمة.",
        });
      }

      if (compensation.type === "voucher") {
        if (!compensation.voucherSource) {
          context.addIssue({
            code: "custom",
            path: ["compensationsJson"],
            message: "حددي مكان صرف القسيمة.",
          });
        }
        if (
          compensation.voucherSource === "branch" &&
          !compensation.voucherBranch
        ) {
          context.addIssue({
            code: "custom",
            path: ["compensationsJson"],
            message: "اختاري فرع صرف القسيمة أو أضيفي فرعًا جديدًا.",
          });
        }
      }

      if (compensation.type === "product") {
        if (compensation.amount !== 0) {
          context.addIssue({
            code: "custom",
            path: ["compensationsJson"],
            message: "القيمة النقدية لمقابل المنتجات يجب أن تكون صفرًا.",
          });
        }
        if (!compensation.productDescription) {
          context.addIssue({
            code: "custom",
            path: ["compensationsJson"],
            message: "اكتبي وصف المنتجات المقدمة للمؤثر.",
          });
        }
      }
    }

    if (value.executionType === "home") {
      if (!value.orderNumber) {
        context.addIssue({
          code: "custom",
          path: ["orderNumber"],
          message: "رقم الطلب مطلوب للتعاون المنزلي.",
        });
      }

      const orderAmount = parseOptionalNumber(value.orderInvoiceAmount);
      if (orderAmount === null || orderAmount < 0) {
        context.addIssue({
          code: "custom",
          path: ["orderInvoiceAmount"],
          message: "أدخلي مبلغ الطلب بقيمة صحيحة.",
        });
      }
    }

    if (value.executionType === "in_branch" && !value.branchName) {
      context.addIssue({
        code: "custom",
        path: ["branchName"],
        message: "اختاري الفرع أو أضيفي اسم فرع جديد.",
      });
    }

    if (value.executionType === "remote" && !value.otherExecutionDetails) {
      context.addIssue({
        code: "custom",
        path: ["otherExecutionDetails"],
        message: "اكتبي تفاصيل نوع التعاون الآخر.",
      });
    }

    if (value.hasContract && !value.paymentTiming) {
      context.addIssue({
        code: "custom",
        path: ["paymentTiming"],
        message: "حددي توقيت الدفع حسب العقد أو الاتفاق.",
      });
    }
  });

function parseOptionalNumber(value: string) {
  const normalized = value.replace(/[\s,]/g, "");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function availabilityMessage(details?: string | null) {
  if (!details) {
    return "هذا المؤثر غير متاح حاليًا للربط بحملة جديدة.";
  }

  try {
    const parsed = JSON.parse(details) as {
      reason?: string;
      campaignName?: string;
      blockedUntil?: string | null;
      daysRemaining?: number | null;
    };

    if (parsed.reason === "active_assignment") {
      return `المؤثر مرتبط حاليًا بحملة ${parsed.campaignName ?? "أخرى"} ولا يمكن ربطه بحملة جديدة.`;
    }

    if (parsed.reason === "settlement_pending") {
      return `المؤثر مرتبط بحملة ${parsed.campaignName ?? "سابقة"} ولم تتم تسوية كامل مستحقاته بعد.`;
    }

    if (parsed.reason === "cooldown") {
      const remaining = parsed.daysRemaining
        ? `، والمتبقي ${parsed.daysRemaining} يومًا`
        : "";
      const date = parsed.blockedUntil
        ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
            new Date(parsed.blockedUntil),
          )
        : "غير محدد";
      return `المؤثر في فترة الحظر بعد حملة ${parsed.campaignName ?? "سابقة"} حتى ${date}${remaining}.`;
    }
  } catch {
    // Fall through to the safe generic message.
  }

  return "هذا المؤثر غير متاح حاليًا للربط بحملة جديدة.";
}

function databaseErrorMessage(message: string) {
  const map: Record<string, string> = {
    ORDER_NUMBER_REQUIRED: "رقم الطلب مطلوب للتعاون المنزلي.",
    ORDER_AMOUNT_REQUIRED: "مبلغ الطلب مطلوب للتعاون المنزلي.",
    BRANCH_REQUIRED: "اختاري فرع التنفيذ الحضوري.",
    OTHER_EXECUTION_DETAILS_REQUIRED: "اكتبي تفاصيل نوع التعاون الآخر.",
    PAYMENT_TIMING_REQUIRED: "حددي توقيت الدفع للتعاون المرتبط بعقد.",
    VOUCHER_SOURCE_REQUIRED: "حددي مكان صرف القسيمة.",
    VOUCHER_BRANCH_REQUIRED: "اختاري فرع صرف القسيمة.",
    PRODUCT_DESCRIPTION_REQUIRED: "اكتبي وصف المنتجات المقدمة للمؤثر.",
    COMPENSATION_AMOUNT_REQUIRED: "أدخلي مبلغ التحويل أو القسيمة.",
    DUPLICATE_COMPENSATION_TYPE: "نوع المقابل مكرر.",
  };

  for (const [code, translated] of Object.entries(map)) {
    if (message.includes(code)) return translated;
  }

  return `تعذر إضافة المؤثر: ${message}`;
}

export async function createCampaignAssignment(
  _previousState: AssignmentActionState,
  formData: FormData,
): Promise<AssignmentActionState> {
  const { supabase } = await requireRole(["admin", "coordinator"]);

  const parsed = assignmentSchema.safeParse({
    campaignId: String(formData.get("campaign_id") ?? ""),
    influencerId: String(formData.get("influencer_id") ?? ""),
    executionType: String(formData.get("execution_type") ?? ""),
    otherExecutionDetails: String(formData.get("other_execution_details") ?? ""),
    requiresContent: formData.get("requires_content") === "true",
    contentDueAtIso: String(formData.get("content_due_at_iso") ?? ""),
    publishingDate: String(formData.get("publishing_date") ?? ""),
    branchName: String(formData.get("branch_name") ?? ""),
    attendanceAtIso: String(formData.get("attendance_at_iso") ?? ""),
    orderNumber: String(formData.get("order_number") ?? ""),
    orderInvoiceAmount: String(formData.get("order_invoice_amount") ?? ""),
    orderNotes: String(formData.get("order_notes") ?? ""),
    hasContract: formData.get("has_contract") === "true",
    contractReference: String(formData.get("contract_reference") ?? ""),
    agreementDate: String(formData.get("agreement_date") ?? ""),
    paymentTiming: String(formData.get("payment_timing") ?? ""),
    contractNotes: String(formData.get("contract_notes") ?? ""),
    coordinatorNotes: String(formData.get("coordinator_notes") ?? ""),
    currency: String(formData.get("currency") ?? "SAR"),
    platformsJson: String(formData.get("platforms_json") ?? "[]"),
    compensationsJson: String(formData.get("compensations_json") ?? "[]"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "راجعي بيانات التكليف قبل الحفظ.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const value = parsed.data;
  const platforms = z.array(platformSchema).parse(JSON.parse(value.platformsJson));
  const compensations = z
    .array(compensationSchema)
    .parse(JSON.parse(value.compensationsJson));
  const orderAmount = parseOptionalNumber(value.orderInvoiceAmount);

  const { data: assignmentId, error } = await supabase.rpc(
    "create_campaign_assignment_bundle_v2",
    {
      p_campaign_id: value.campaignId,
      p_influencer_id: value.influencerId,
      p_execution_type: value.executionType,
      p_other_execution_details: value.otherExecutionDetails || null,
      p_requires_content: value.requiresContent,
      p_content_due_at: value.contentDueAtIso || null,
      p_publishing_date: value.publishingDate || null,
      p_branch_name: value.branchName || null,
      p_attendance_at: value.attendanceAtIso || null,
      p_order_number: value.orderNumber || null,
      p_order_invoice_amount: orderAmount,
      p_order_notes: value.orderNotes || null,
      p_has_contract: value.hasContract,
      p_contract_reference: value.contractReference || null,
      p_agreement_date: value.agreementDate || null,
      p_payment_timing: value.hasContract ? value.paymentTiming || null : null,
      p_contract_notes: value.contractNotes || null,
      p_coordinator_notes: value.coordinatorNotes || null,
      p_currency: value.currency || "SAR",
      p_compensations: compensations,
      p_platforms: platforms,
    },
  );

  if (error) {
    if (error.message.includes("INFLUENCER_UNAVAILABLE")) {
      return {
        ok: false,
        code: "INFLUENCER_UNAVAILABLE",
        message: availabilityMessage(error.details),
      };
    }

    if (error.code === "23505") {
      return {
        ok: false,
        code: "DUPLICATE_ASSIGNMENT",
        message: "هذا المؤثر مضاف مسبقًا إلى الحملة أو توجد بيانات مكررة.",
      };
    }

    return {
      ok: false,
      code: "SAVE_FAILED",
      message: databaseErrorMessage(error.message),
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${value.campaignId}`);
  redirect(`/dashboard/campaigns/${value.campaignId}?assignment=${assignmentId}`);
}
