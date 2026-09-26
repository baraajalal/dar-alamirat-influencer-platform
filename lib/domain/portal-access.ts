export const PORTAL_ACCESS_STATUS = {
  submitted: "submitted",
  underReview: "under_review",
  needsChanges: "needs_changes",
  approved: "approved",
  rejected: "rejected",
  activated: "activated",
  cancelled: "cancelled",
} as const;

export type PortalAccessStatus = (typeof PORTAL_ACCESS_STATUS)[keyof typeof PORTAL_ACCESS_STATUS];

export const PORTAL_ACCESS_OPEN_STATUSES: PortalAccessStatus[] = [
  PORTAL_ACCESS_STATUS.submitted,
  PORTAL_ACCESS_STATUS.underReview,
  PORTAL_ACCESS_STATUS.needsChanges,
  PORTAL_ACCESS_STATUS.approved,
];

export const PORTAL_ACCESS_REVIEW_QUEUE_STATUSES: PortalAccessStatus[] = [
  PORTAL_ACCESS_STATUS.submitted,
  PORTAL_ACCESS_STATUS.underReview,
];

export const PORTAL_ACCESS_PUBLIC_EDIT_LOCKED_STATUSES: PortalAccessStatus[] = [
  PORTAL_ACCESS_STATUS.underReview,
  PORTAL_ACCESS_STATUS.needsChanges,
  PORTAL_ACCESS_STATUS.approved,
];

export const PORTAL_ACCESS_STATUS_LABELS_AR: Record<PortalAccessStatus, string> = {
  submitted: "تم الإرسال",
  under_review: "تحت المراجعة",
  needs_changes: "مطلوب تعديل",
  approved: "تمت الموافقة - بانتظار التفعيل",
  rejected: "مرفوض",
  activated: "مفعّل",
  cancelled: "ملغي",
};

export const PORTAL_ACCESS_STATUS_LABELS_EN: Record<PortalAccessStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  needs_changes: "Needs changes",
  approved: "Approved - awaiting activation",
  rejected: "Rejected",
  activated: "Activated",
  cancelled: "Cancelled",
};
