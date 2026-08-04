import { api } from "@/constants/api";
import {
  VERIFICATION_STATUS,
  isVerificationStatus,
  type VerificationStatus,
} from "@/constants/verificationStatus";
import { ACCOUNT_STATUS, isAccountStatus } from "@/constants/accountStatus";
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

  const rawAccountStatus = body?.accountStatus as string | undefined;
  const accountStatus =
    rawAccountStatus && isAccountStatus(rawAccountStatus)
      ? rawAccountStatus
      : ACCOUNT_STATUS.ACTIVE;
  const statusReason = (body?.statusReason as string | null) ?? null;

  if (verification?.status && isVerificationStatus(verification.status)) {
    return {
      name: String(body.name ?? body.fullName ?? "Partner"),
      verification: {
        status: verification.status,
        rejectionReason: verification.rejectionReason ?? null,
      },
      accountStatus,
      statusReason,
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
      accountStatus,
      statusReason,
    };
  }

  throw new Error("Unrecognized partner profile response");
}

/**
 * Resolves a 403 accountStatus response into a clean PartnerProfile so that
 * VerificationGate and the status screens can read `data` directly rather
 * than receiving an error.
 */
function resolveAccountStatusError(
  data: Record<string, unknown>
): PartnerProfile | null {
  const { accountStatus, statusReason } = data as {
    accountStatus?: string;
    statusReason?: string | null;
  };
  if (!accountStatus) return null;
  const resolvedStatus =
    isAccountStatus(accountStatus) ? accountStatus : ACCOUNT_STATUS.ACTIVE;
  return {
    name: "",
    verification: {
      status: VERIFICATION_STATUS.VERIFIED,
      rejectionReason: null,
    },
    accountStatus: resolvedStatus,
    statusReason: (statusReason ?? null) as string | null,
  };
}

/**
 * GET /partner/me — primary verification status endpoint.
 * Falls back to /partner/auth/me when /partner/me is not yet deployed.
 *
 * A 403 with accountStatus means blocked/suspended — resolved cleanly as a
 * valid PartnerProfile so VerificationGate reads `data`, not `error`.
 */
export async function fetchPartnerMe(): Promise<PartnerProfile> {
  try {
    const res = await api.get("/partner/me");
    return normalizePartnerProfile(res.data);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { status?: number; data?: Record<string, unknown> } };
    const status = axiosErr?.response?.status;

    // 403 with accountStatus → blocked or suspended; resolve cleanly so
    // VerificationGate and the status screens can read `data` directly.
    if (status === 403 && axiosErr.response?.data?.accountStatus) {
      const resolved = resolveAccountStatusError(axiosErr.response.data);
      if (resolved) return resolved;
    }

    // 404 → fall back to the legacy endpoint (/partner/auth/me).
    // The legacy endpoint also goes through protectPartner middleware, so it
    // can return 403 for blocked/suspended partners — handle that too.
    if (status === 404) {
      try {
        const res = await api.get("/partner/auth/me");
        return normalizePartnerProfile(res.data);
      } catch (fallbackErr: unknown) {
        const fbAxiosErr = fallbackErr as {
          response?: { status?: number; data?: Record<string, unknown> };
        };
        const fbStatus = fbAxiosErr?.response?.status;

        // 403 from the legacy endpoint → same blocked/suspended handling
        if (fbStatus === 403 && fbAxiosErr.response?.data?.accountStatus) {
          const resolved = resolveAccountStatusError(fbAxiosErr.response.data);
          if (resolved) return resolved;
        }

        throw fallbackErr;
      }
    }

    throw err;
  }
}
