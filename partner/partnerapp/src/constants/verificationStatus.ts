/**
 * Partner KYC verification statuses — single source of truth.
 *
 * Returned by GET /partner/me as:
 *   { verification: { status, rejectionReason } }
 *
 * Import VERIFICATION_STATUS everywhere instead of string literals.
 */

export const VERIFICATION_STATUS = {
  NOT_SUBMITTED: "NOT_SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

export type VerificationStatus =
  (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

/** Nested verification object shape from GET /partner/me */
export type PartnerVerification = {
  status: VerificationStatus;
  rejectionReason: string | null;
};

/** All valid status values — useful for runtime validation */
export const VERIFICATION_STATUS_VALUES = Object.values(
  VERIFICATION_STATUS
) as VerificationStatus[];

/** Type guard for parsing API responses safely */
export function isVerificationStatus(
  value: unknown
): value is VerificationStatus {
  return (
    typeof value === "string" &&
    VERIFICATION_STATUS_VALUES.includes(value as VerificationStatus)
  );
}

/** Human-readable labels for UI screens */
export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  [VERIFICATION_STATUS.NOT_SUBMITTED]: "Not Submitted",
  [VERIFICATION_STATUS.UNDER_REVIEW]: "Under Review",
  [VERIFICATION_STATUS.VERIFIED]: "Verified",
  [VERIFICATION_STATUS.REJECTED]: "Rejected",
};
