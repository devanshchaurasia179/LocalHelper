/**
 * useDocumentUpload.ts
 *
 * Mutation hook for POST /partner/verification/documents.
 *
 * Handles the full upload lifecycle:
 *   1. Calls uploadDocument() with the payload
 *   2. On success, patches the React Query cache directly — no extra GET needed
 *   3. If the session transitions to "Under Review", also invalidates the
 *      partner status query so VerificationGate re-routes automatically
 *
 * Per-document loading state: the caller passes documentTypeId + side,
 * and this hook tracks which specific slot is uploading via `uploadingKey`.
 * This lets the UI show a spinner only on the card being uploaded, not all.
 *
 * WHY patch cache instead of invalidating?
 * The backend returns the updated document object in the upload response.
 * We can splice it into the existing documents[] array without an extra
 * network round-trip. The UI stays snappy even on slow connections.
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { uploadDocument } from "@/api/verification.api";
import { VERIFICATION_QUERY_KEY } from "@/hooks/useVerification";
import { PARTNER_STATUS_QUERY_KEY } from "@/hooks/usePartnerStatus";
import type {
  UploadDocumentPayload,
  VerificationDocument,
  VerificationResponse,
} from "@/types/verification";

export type UploadResult =
  | { ok: true;  document: VerificationDocument; sessionStatus: string }
  | { ok: false; message: string };

export function useDocumentUpload() {
  const queryClient = useQueryClient();

  // Tracks which slot is currently uploading: "documentTypeId_side" or null
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const upload = useCallback(
    async (payload: UploadDocumentPayload): Promise<UploadResult> => {
      const slotKey = `${payload.documentTypeId}_${payload.side}`;
      setUploadingKey(slotKey);

      try {
        const response = await uploadDocument(payload);

        // ── Patch the documents[] array in the cache ──────────────────────
        queryClient.setQueryData<VerificationResponse>(
          VERIFICATION_QUERY_KEY,
          (prev) => {
            if (!prev) return prev;

            // Replace the matching document card in place
            const updatedDocuments = prev.documents.map((doc) =>
              doc.documentTypeId === payload.documentTypeId &&
              doc.side === payload.side
                ? response.document
                : doc
            );

            // Recompute summary counts from the updated document list
            const uploadedCount = updatedDocuments.filter(
              (d) => d.uploadStatus !== "missing"
            ).length;
            const approvedCount = updatedDocuments.filter(
              (d) => d.uploadStatus === "approved"
            ).length;
            const rejectedCount = updatedDocuments.filter(
              (d) => d.uploadStatus === "rejected"
            ).length;
            const underReviewCount = updatedDocuments.filter(
              (d) => d.uploadStatus === "under_review"
            ).length;
            const missingCount = updatedDocuments.filter(
              (d) => d.uploadStatus === "missing"
            ).length;

            // Recompute progress (required docs only)
            const requiredDocs = updatedDocuments.filter((d) => d.isRequired);
            const coveredRequired = requiredDocs.filter(
              (d) => d.uploadStatus !== "missing"
            ).length;

            return {
              ...prev,
              sessionStatus: response.sessionStatus,
              documents: updatedDocuments,
              summary: {
                total:       updatedDocuments.length,
                uploaded:    uploadedCount,
                approved:    approvedCount,
                rejected:    rejectedCount,
                underReview: underReviewCount,
                missing:     missingCount,
              },
              progress: {
                uploaded:   coveredRequired,
                total:      requiredDocs.length,
                percentage:
                  requiredDocs.length > 0
                    ? Math.round((coveredRequired / requiredDocs.length) * 100)
                    : 100,
              },
            };
          }
        );

        // ── If session moved to "Under Review", refresh partner status ─────
        // VerificationGate watches this and will re-route automatically.
        if (
          response.sessionStatus === "Under Review" ||
          response.sessionStatus === "Re-submitted"
        ) {
          queryClient.invalidateQueries({ queryKey: PARTNER_STATUS_QUERY_KEY });
        }

        return {
          ok: true,
          document: response.document,
          sessionStatus: response.sessionStatus,
        };
      } catch (error: any) {
        const message =
          error?.message ?? "Upload failed. Please check your connection.";
        return { ok: false, message };
      } finally {
        setUploadingKey(null);
      }
    },
    [queryClient]
  );

  const isUploading = (documentTypeId: string, side: string) =>
    uploadingKey === `${documentTypeId}_${side}`;

  return { upload, uploadingKey, isUploading };
}
