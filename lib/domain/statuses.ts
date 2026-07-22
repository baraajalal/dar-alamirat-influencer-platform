export const USER_ROLES = [
  "influencer",
  "coordinator",
  "reviewer",
  "finance",
  "admin",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CAMPAIGN_STATUSES = [
  "draft",
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
  "archived",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ASSIGNMENT_STATUSES = [
  "invited",
  "accepted",
  "declined",
  "brief_sent",
  "in_progress",
  "submitted",
  "changes_requested",
  "approved",
  "published",
  "completed",
  "cancelled",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const CONTENT_STATUSES = [
  "draft",
  "submitted",
  "under_review",
  "changes_requested",
  "approved",
  "rejected",
  "published",
  "archived",
] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "not_due",
  "pending_documents",
  "ready",
  "submitted",
  "processing",
  "paid",
  "on_hold",
  "cancelled",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const METRIC_SYNC_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "partial",
  "failed",
  "manual_required",
] as const;
export type MetricSyncStatus = (typeof METRIC_SYNC_STATUSES)[number];
