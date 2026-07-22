import type {
  AssignmentStatus,
  CampaignStatus,
  ContentStatus,
  PaymentStatus,
} from "./statuses";

type TransitionMap<T extends string> = Readonly<Record<T, readonly T[]>>;

export const CAMPAIGN_TRANSITIONS: TransitionMap<CampaignStatus> = {
  draft: ["planned", "cancelled"],
  planned: ["active", "paused", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

export const ASSIGNMENT_TRANSITIONS: TransitionMap<AssignmentStatus> = {
  invited: ["accepted", "declined", "cancelled"],
  accepted: ["brief_sent", "cancelled"],
  declined: [],
  brief_sent: ["in_progress", "cancelled"],
  in_progress: ["submitted", "cancelled"],
  submitted: ["changes_requested", "approved"],
  changes_requested: ["submitted", "cancelled"],
  approved: ["published", "completed"],
  published: ["completed"],
  completed: [],
  cancelled: [],
};

export const CONTENT_TRANSITIONS: TransitionMap<ContentStatus> = {
  draft: ["submitted"],
  submitted: ["under_review", "changes_requested", "approved", "rejected"],
  under_review: ["changes_requested", "approved", "rejected"],
  changes_requested: ["submitted"],
  approved: ["published", "archived"],
  rejected: ["archived"],
  published: ["archived"],
  archived: [],
};

export const PAYMENT_TRANSITIONS: TransitionMap<PaymentStatus> = {
  not_due: ["pending_documents", "ready", "cancelled"],
  pending_documents: ["ready", "on_hold", "cancelled"],
  ready: ["submitted", "on_hold", "cancelled"],
  submitted: ["processing", "on_hold"],
  processing: ["paid", "on_hold"],
  paid: [],
  on_hold: ["pending_documents", "ready", "submitted", "processing", "cancelled"],
  cancelled: [],
};

export function canTransition<T extends string>(
  map: TransitionMap<T>,
  from: T,
  to: T,
): boolean {
  return map[from].includes(to);
}
