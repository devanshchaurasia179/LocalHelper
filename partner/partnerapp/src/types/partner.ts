import type { PartnerVerification } from "@/constants/verificationStatus";
import type { AccountStatus } from "@/constants/accountStatus";

/** Normalized partner profile from GET /partner/me */
export type PartnerProfile = {
  name: string;
  verification: PartnerVerification;
  accountStatus: AccountStatus;
  statusReason: string | null;
};
