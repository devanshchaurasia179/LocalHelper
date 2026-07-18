import type { PartnerVerification } from "@/constants/verificationStatus";

/** Normalized partner profile from GET /partner/me */
export type PartnerProfile = {
  name: string;
  verification: PartnerVerification;
};
