/**
 * useDeleteDocumentPhoto.ts
 *
 * Mutation hook for removing a single photo from a Pending document slot.
 *
 * DELETE /partner/verification/documents/:documentTypeId/:side/photos/:photoIndex
 *
 * Two outcomes:
 *   slotDeleted: true  — the last photo was removed; the slot goes back to
 *                        "missing". We remove the document from the cache and
 *                        recompute progress.
 *   slotDeleted: false — one photo was removed; the server returns the updated
 *                        VerificationDocument which we splice into the cache.
 *
 * Per-photo loading state is tracked via `deletingKey`:
 *   `${documentTypeId}_${side}_${photoIndex}`
 * This lets the UI show a spinner only on the thumb being deleted.
 */

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { deleteDocumentPhoto } from "@/api/verification.api";
import { VERIFICATION_QUERY_KEY } from "@/hooks/useVerification";
import type { VerificationDocument, VerificationResponse } from "@/types/verification";

export type DeletePhotoResult =
  | { ok: true;  slotDeleted: boolean; document?: VerificationDocument }
  | { ok: false; message: string };

export function useDeleteDocumentPhoto() {
  const queryClient = useQueryClient();
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const deletePhoto = useCallback(
    async (
      documentTypeId: string,
      side: string,
      photoIndex: number
    ): Promise<DeletePhotoResult> => {
      const key = `${documentTypeId}_${side}_${photoIndex}`;
      setDeletingKey(key);

      try {
        const response = await deleteDocumentPhoto(documentTypeId, side, photoIndex);

        // ── Patch the cache ───────────────────────────────────────────────
        queryClient.setQueryData<VerificationResponse>(
          VERIFICATION_QUERY_KEY,
          (prev) => {
            if (!prev) return prev;

            let updatedDocuments: VerificationDocument[];

            if (response.slotDeleted) {
              // Remove the document card entirely — slot is now "missing".
              // The backend no longer has a record for this slot, so we restore
              // the "missing" placeholder by filtering it out. The next GET
              // will rebuild it, but since we want instant UI feedback we
              // set the card's uploadStatus to "missing" instead.
              updatedDocuments = prev.documents.map((doc) =>
                doc.documentTypeId === documentTypeId && doc.side === side
                  ? {
                      ...doc,
                      uploadStatus: "missing" as const,
                      badge: { label: "Not Uploaded", color: "gray" as const },
                      action: { type: "upload" as const, label: "Upload Document" },
                      previewUrl: null,
                      previewUrls: [],
                      numberValue: null,
                      uploadedAt: null,
                      version: null,
                      versionLabel: null,
                    }
                  : doc
              );
            } else {
              // Splice the updated document in place
              updatedDocuments = prev.documents.map((doc) =>
                doc.documentTypeId === documentTypeId && doc.side === side
                  ? response.document!
                  : doc
              );
            }

            // Recompute progress
            const requiredDocs = updatedDocuments.filter((d) => d.isRequired);
            const coveredRequired = requiredDocs.filter(
              (d) => d.uploadStatus !== "missing"
            ).length;

            return {
              ...prev,
              documents: updatedDocuments,
              summary: {
                total:       updatedDocuments.length,
                uploaded:    updatedDocuments.filter((d) => d.uploadStatus !== "missing").length,
                approved:    updatedDocuments.filter((d) => d.uploadStatus === "approved").length,
                rejected:    updatedDocuments.filter((d) => d.uploadStatus === "rejected").length,
                underReview: updatedDocuments.filter((d) => d.uploadStatus === "under_review").length,
                missing:     updatedDocuments.filter((d) => d.uploadStatus === "missing").length,
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

        return {
          ok: true,
          slotDeleted: response.slotDeleted,
          document: response.slotDeleted ? undefined : (response as any).document,
        };
      } catch (error: any) {
        return {
          ok: false,
          message: error?.message ?? "Failed to remove photo. Please try again.",
        };
      } finally {
        setDeletingKey(null);
      }
    },
    [queryClient]
  );

  const isDeleting = (documentTypeId: string, side: string, photoIndex: number) =>
    deletingKey === `${documentTypeId}_${side}_${photoIndex}`;

  return { deletePhoto, deletingKey, isDeleting };
}
