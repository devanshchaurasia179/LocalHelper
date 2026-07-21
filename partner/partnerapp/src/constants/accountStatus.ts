/**
 * Partner account statuses — set by admin actions (block/suspend).
 *
 * Returned by GET /partner/me as:
 *   { accountStatus, statusReason }
 *
 * These are separate from verification status — a verified partner
 * can still be blocked or suspended by an admin.
 */

export const ACCOUNT_STATUS = {
  ACTIVE: "Active",
  BLOCKED: "Blocked",
  SUSPENDED: "Suspended",
} as const;

export type AccountStatus =
  (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

/** Type guard for parsing API responses safely */
export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === "string" &&
    Object.values(ACCOUNT_STATUS).includes(value as AccountStatus)
  );
}
