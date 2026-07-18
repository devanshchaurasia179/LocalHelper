/**
 * verification.api.ts
 *
 * All HTTP calls for the partner verification flow.
 *
 * Two endpoints:
 *   GET  /partner/verification           — fetch the full verification state
 *   POST /partner/verification/documents — upload a single document file
 *
 * WHY XMLHttpRequest for the upload?
 * React Native's `fetch()` passes FormData through a JS polyfill that throws
 * "unsupported FormData part implementation" when it encounters the
 * { uri, name, type } file-object format required by React Native.
 * XHR bypasses that polyfill and hands FormData directly to the native layer,
 * which correctly serialises file URIs into multipart/form-data — with the
 * correct Content-Type boundary header included automatically.
 *
 * The GET call uses axios (no file, no FormData) — perfectly fine.
 */

import { api, BASE_URL } from "@/constants/api";
import type {
  VerificationResponse,
  UploadDocumentPayload,
  UploadDocumentResponse,
} from "@/types/verification";

// ─── GET /partner/verification ─────────────────────────────────────────────

/**
 * Fetches the complete verification state for the logged-in partner.
 * Used as the queryFn for useVerification().
 */
export async function fetchVerification(): Promise<VerificationResponse> {
  const res = await api.get<VerificationResponse>("/partner/verification");
  return res.data;
}

// ─── POST /partner/verification/documents ──────────────────────────────────

/**
 * Uploads a single document file.
 *
 * Works for ANY document type — no document-specific logic here.
 * The caller provides documentTypeId + side (from the backend response).
 *
 * Returns the updated document object from the backend so React Query
 * can update the cache optimistically or after settlement.
 */
export async function uploadDocument(
  payload: UploadDocumentPayload
): Promise<UploadDocumentResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();

    // ── File field — { uri, name, type } is the required React Native format ──
    const ext = payload.mimeType.split("/")[1] ?? "jpg";
    const filename = `${payload.documentTypeId}_${payload.side}.${ext}`;

    form.append("file", {
      uri: payload.fileUri,
      name: filename,
      type: payload.mimeType,
    } as any);

    // ── Body fields ─────────────────────────────────────────────────────────
    form.append("documentTypeId", payload.documentTypeId);
    form.append("side", payload.side);

    if (payload.numberValue) {
      form.append("numberValue", payload.numberValue.trim().toUpperCase());
    }

    // ── XHR ─────────────────────────────────────────────────────────────────
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE_URL}/partner/verification/documents`);
    xhr.withCredentials = true; // sends the partner_token httpOnly cookie
    // Do NOT set Content-Type — XHR sets multipart/form-data + boundary automatically

    xhr.timeout = 30_000; // 30 s — file uploads can be slow on mobile

    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = { message: xhr.responseText };
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadDocumentResponse);
      } else {
        reject(
          new Error(body?.message ?? `Upload failed with status ${xhr.status}`)
        );
      }
    };

    xhr.onerror = () => reject(new Error("Network request failed"));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again."));

    xhr.send(form);
  });
}
