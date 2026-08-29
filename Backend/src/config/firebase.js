import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getMessaging as getFirebaseMessaging } from "firebase-admin/messaging";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

/**
 * Firebase Admin SDK bootstrap.
 *
 * Credentials are read from env (never hardcoded / committed). Two options,
 * checked in this order:
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH — absolute/relative path to a service
 *      account JSON file.
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON — the service account JSON as an inline
 *      string (handy for hosted environments that only support env vars).
 *
 * If neither is present or the value is invalid, we log a warning and skip
 * initialization. The rest of the app keeps running — push notifications are
 * simply disabled until valid credentials are provided.
 */

// Holds the initialized Firebase app instance (null until initialized).
let firebaseApp = null;

/** Parse the service account from whichever env var is set. Returns null if none/invalid. */
const loadServiceAccount = () => {
  const jsonPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const jsonInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  // Preferred: a path to the service account JSON file.
  // If the path is set but unreadable, warn and fall back to inline JSON below
  // rather than failing outright.
  if (jsonPath) {
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    }
    console.warn(
      `[firebase] FIREBASE_SERVICE_ACCOUNT_PATH is set but no file was found at "${jsonPath}". Falling back to FIREBASE_SERVICE_ACCOUNT_JSON.`
    );
  }

  // Fallback: the service account JSON provided inline as a string.
  if (jsonInline) {
    return JSON.parse(jsonInline);
  }

  return null;
};

/**
 * Initialize the Firebase Admin app.
 * Safe to call multiple times — subsequent calls are no-ops.
 * Returns the app instance if Firebase is ready, or null otherwise.
 */
export const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  // Reuse an already-initialized app (e.g. across hot reloads)
  if (getApps().length > 0) {
    firebaseApp = getApp();
    return firebaseApp;
  }

  try {
    const serviceAccount = loadServiceAccount();

    if (!serviceAccount) {
      console.warn(
        "[firebase] No credentials found. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON. Push notifications are disabled."
      );
      return null;
    }

    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });

    console.log("[firebase] Admin SDK initialized.");
    return firebaseApp;
  } catch (error) {
    console.warn(
      "[firebase] Failed to initialize Admin SDK. Push notifications are disabled.",
      error?.message || error
    );
    return null;
  }
};

/** Whether the Admin SDK has been successfully initialized. */
export const isFirebaseInitialized = () => !!firebaseApp || getApps().length > 0;

/** Returns the initialized Firebase app instance, or null if not initialized. */
export const getFirebaseApp = () => firebaseApp;

/**
 * Returns the Firebase Cloud Messaging service.
 * Throws if Firebase was never initialized — callers should guard with
 * isFirebaseInitialized() before sending.
 */
export const getMessaging = () => getFirebaseMessaging();

// Default export: initialize (idempotent) and hand back the app instance.
export default initFirebase();
