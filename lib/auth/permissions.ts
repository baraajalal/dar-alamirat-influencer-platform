export type AppRole =
  | "admin"
  | "coordinator"
  | "finance"
  | "reviewer"
  | "viewer"
  | "influencer";

export type PermissionResource =
  | "dashboard"
  | "influencers"
  | "campaigns"
  | "content"
  | "payments"
  | "messages"
  | "reports"
  | "access_requests"
  | "users"
  | "settings";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "approve"
  | "pay"
  | "manage";

type PermissionMatrix = Record<
  AppRole,
  Partial<Record<PermissionResource, readonly PermissionAction[]>>
>;

export const ROLE_PERMISSIONS: PermissionMatrix = {
  admin: {
    dashboard: ["view", "manage"],
    influencers: ["view", "create", "update", "delete", "approve", "manage"],
    campaigns: ["view", "create", "update", "delete", "approve", "manage"],
    content: ["view", "create", "update", "delete", "approve", "manage"],
    payments: ["view", "create", "update", "approve", "pay", "manage"],
    messages: ["view", "create", "update", "delete", "manage"],
    reports: ["view", "manage"],
    access_requests: ["view", "approve", "manage"],
    users: ["view", "create", "update", "delete", "manage"],
    settings: ["view", "update", "manage"],
  },
  coordinator: {
    dashboard: ["view"],
    influencers: ["view", "create", "update"],
    campaigns: ["view", "create", "update"],
    content: ["view", "create", "update"],
    payments: ["view"],
    messages: ["view", "create"],
    reports: ["view"],
    access_requests: ["view"],
  },
  finance: {
    dashboard: ["view"],
    campaigns: ["view"],
    influencers: ["view"],
    payments: ["view", "create", "update", "approve", "pay"],
    reports: ["view"],
    access_requests: ["view"],
  },
  reviewer: {
    dashboard: ["view"],
    campaigns: ["view"],
    influencers: ["view"],
    content: ["view", "update", "approve"],
    messages: ["view", "create"],
    reports: ["view"],
  },
  viewer: {
    dashboard: ["view"],
    influencers: ["view"],
    campaigns: ["view"],
    content: ["view"],
    payments: ["view"],
    reports: ["view"],
  },
  influencer: {},
};

export function normalizeAppRole(role: string): AppRole {
  if (role in ROLE_PERMISSIONS) return role as AppRole;
  return "viewer";
}

export function hasPermission(
  role: string,
  resource: PermissionResource,
  action: PermissionAction = "view",
) {
  const normalizedRole = normalizeAppRole(role);
  return ROLE_PERMISSIONS[normalizedRole][resource]?.includes(action) ?? false;
}

export function roleCanManage(role: string, resource: PermissionResource) {
  return hasPermission(role, resource, "manage");
}
