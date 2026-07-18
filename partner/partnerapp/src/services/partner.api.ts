import { api } from "@/constants/api";
import {
  VERIFICATION_STATUS,
  isVerificationStatus,
  type VerificationStatus,
} from "@/constants/verificationStatus";
import type { PartnerProfile } from "@/types/partner";

/** Maps legacy backend verificationStatus strings to the canonical enum */
const LEGACY_STATUS_MAP: Record<string, VerificationStatus> = {
  Pending: VERIFICATION_STATUS.NOT_SUBMITTED,
  "Under Review": VERIFICATION_STATUS.UNDER_REVIEW,
  Approved: VERIFICATION_STATUS.VERIFIED,
  Rejected: VERIFICATION_STATUS.REJECTED,
};

function mapLegacyStatus(
  verificationStatus: string,
  isDocument?: boolean
): VerificationStatus {
  if (!isDocument) return VERIFICATION_STATUS.NOT_SUBMITTED;
  if (verificationStatus === "Pending") {
    return VERIFICATION_STATUS.UNDER_REVIEW;
  }
  return LEGACY_STATUS_MAP[verificationStatus] ?? VERIFICATION_STATUS.NOT_SUBMITTED;
}

/**
 * Normalizes both the spec response shape and the legacy /partner/auth/me shape
 * into a single PartnerProfile the app can rely on.
 */
export function normalizePartnerProfile(raw: unknown): PartnerProfile {
  const data = raw as Record<string, unknown>;
  const body = (data?.verification ? data : data?.partner ?? data) as Record<
    string,
    unknown
  >;

  const verification = body?.verification as
    | { status?: unknown; rejectionReason?: string | null }
    | undefined;

  if (verification?.status && isVerificationStatus(verification.status)) {
    return {
      name: String(body.name ?? body.fullName ?? "Partner"),
      verification: {
        status: verification.status,
        rejectionReason: verification.rejectionReason ?? null,
      },
    };
  }

  const legacyStatus = body?.verificationStatus as string | undefined;
  if (legacyStatus) {
    return {
      name: String(body.fullName ?? body.name ?? "Partner"),
      verification: {
        status: mapLegacyStatus(legacyStatus, Boolean(body.isDocument)),
        rejectionReason: (body.rejectionReason as string | null) ?? null,
      },
    };
  }

  throw new Error("Unrecognized partner profile response");
}

/**
 * GET /partner/me — primary verification status endpoint.
 * Falls back to /partner/auth/me when /partner/me is not yet deployed.
 */
export async function fetchPartnerMe(): Promise<PartnerProfile> {
  try {
    const res = await api.get("/partner/me");
    return normalizePartnerProfile(res.data);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 404) {
      const res = await api.get("/partner/auth/me");
      return normalizePartnerProfile(res.data);
    }
    throw err;
  }
}
