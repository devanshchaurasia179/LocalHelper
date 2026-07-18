import { useState, useCallback } from "react";
import { BASE_URL } from "@/constants/api";
import { useAuth } from "@/providers/AuthProvider";
import {
  VERIFICATION_STATUS,
  type VerificationStatus,
} from "@/constants/verificationStatus";

export type KycUploadResult =
  | { ok: true; verificationStatus: VerificationStatus }
  | { ok: false };

/** Maps legacy backend KYC response status to canonical enum */
function mapKycVerificationStatus(raw?: string): VerificationStatus {
  switch (raw) {
    case "Under Review":
      return VERIFICATION_STATUS.UNDER_REVIEW;
    case "Approved":
      return VERIFICATION_STATUS.VERIFIED;
    case "Rejected":
      return VERIFICATION_STATUS.REJECTED;
    default:
      return VERIFICATION_STATUS.UNDER_REVIEW;
  }
}

export type KycPayload = {
  aadhaarNumber: string;
  aadhaarFront: string; // local file URI  (e.g. file:///...)
  aadhaarBack: string;  // local file URI
  selfie: string;       // local file URI  — required
  panNumber?: string;
  panImage?: string;    // local file URI  — optional
};

/**
 * useUploadDocuments
 *
 * WHY XMLHttpRequest instead of fetch()?
 * React Native's fetch() passes FormData through a JS-layer polyfill that
 * throws "unsupported FormData part implementation" when it encounters the
 * { uri, name, type } file object format.
 * XMLHttpRequest bypasses that polyfill and hands the FormData directly to
 * the native networking layer, which correctly serialises file URIs into a
 * proper multipart/form-data stream — including the boundary header.
 */
export function useUploadDocuments() {
  const { patchPartner } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState<string | null>(null);

  const submit = useCallback(
    async (payload: KycPayload): Promise<KycUploadResult> => {
      setError(null);
      setLoading(true);

      try {
        const form = new FormData();

        // ── Text fields ──────────────────────────────────────────────────
        form.append("aadhaarNumber", payload.aadhaarNumber);
        if (payload.panNumber) form.append("panNumber", payload.panNumber);

        // ── Image fields — { uri, name, type } is the correct RN format ──
        form.append("aadhaarFront", { uri: payload.aadhaarFront, name: "aadhaar_front.jpg", type: "image/jpeg" } as any);
        form.append("aadhaarBack",  { uri: payload.aadhaarBack,  name: "aadhaar_back.jpg",  type: "image/jpeg" } as any);
        form.append("selfie",       { uri: payload.selfie,       name: "selfie.jpg",         type: "image/jpeg" } as any);

        if (payload.panImage) {
          form.append("panImage", { uri: payload.panImage, name: "pan_card.jpg", type: "image/jpeg" } as any);
        }

        // ── Send via XHR — bypasses the broken fetch FormData polyfill ───
        const result = await sendWithXhr(
          "PUT",
          `${BASE_URL}/partner/documents/kyc`,
          form
        );

        if (!result.ok) {
          setError(result.body?.message ?? "Failed to submit documents. Please try again.");
          return { ok: false };
        }

        patchPartner({ isDocument: true });

        const verificationStatus = mapKycVerificationStatus(
          result.body?.kyc?.verificationStatus
        );

        return { ok: true, verificationStatus };
      } catch (e: any) {
        setError(e?.message ?? "Network error. Please check your connection.");
        return { ok: false };
      } finally {
        setLoading(false);
      }
    },
    [patchPartner]
  );

  return { submit, loading, error, clearError: () => setError(null) };
}

// ─── XHR helper ───────────────────────────────────────────────────────────────

type XhrResult = { ok: boolean; status: number; body: any };

function sendWithXhr(method: string, url: string, form: FormData): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    // Send the httpOnly cookie (partner_token)
    xhr.withCredentials = true;

    // DO NOT set Content-Type — XHR sets it automatically with the correct boundary

    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { body = xhr.responseText; }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, body });
    };

    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));
    xhr.timeout = 30_000; // 30 s — uploads can be slow on mobile

    xhr.send(form);
  });
}
