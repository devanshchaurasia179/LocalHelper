/**
 * PushService — Partner App
 *
 * Registers this device for Firebase Cloud Messaging (FCM) push notifications
 * and keeps the backend in sync with the current device token.
 *
 * Flow:
 *   1. Ask for notification permission (Android 13+ needs the runtime
 *      POST_NOTIFICATIONS grant; older Android auto-grants).
 *   2. Fetch the FCM registration token via @react-native-firebase/messaging.
 *   3. POST it to /api/partner/fcm-token so pushes can be delivered.
 *   4. Subscribe to onTokenRefresh and re-POST whenever the token rotates.
 *   5. On logout, DELETE the token so this device stops receiving pushes.
 *
 * Auth is cookie-based (partner_token httpOnly cookie) and sent automatically
 * by the shared `api` client (withCredentials: true).
 *
 * This app is Android-only, so platform is always 'android'. Everything is
 * wrapped defensively — a push failure must never break login/logout.
 */

import { Platform, PermissionsAndroid } from "react-native";
import * as Device from "expo-device";
import {
  getMessaging,
  getToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import { api } from "@/constants/api";

const PLATFORM = "android" as const;

// Unsubscribe handle for the onTokenRefresh listener so we don't double-register.
let _unsubscribeTokenRefresh: (() => void) | null = null;
// The token we last sent to the backend — used to DELETE the right one on logout.
let _currentToken: string | null = null;

// ─── Permission ───────────────────────────────────────────────────────────────

/**
 * Request notification permission.
 * On Android 13+ (API 33) POST_NOTIFICATIONS is a runtime permission; on older
 * versions it is granted at install time so we short-circuit to true.
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  // POST_NOTIFICATIONS only exists on API 33+. Below that it's install-time.
  if (typeof Platform.Version === "number" && Platform.Version < 33) {
    return true;
  }

  try {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn("[Push] POST_NOTIFICATIONS request failed:", err);
    return false;
  }
}

// ─── Token fetch (with retry) ───────────────────────────────────────────────

/**
 * Fetch the FCM registration token, retrying on transient failures.
 *
 * `getToken()` can throw `java.io.IOException: FCM Registration failed!` when
 * Google Play Services is momentarily unavailable or the network is flaky.
 * These are usually transient, so we retry a few times with exponential
 * backoff before giving up.
 */
async function getTokenWithRetry(
  attempts = 3,
  baseDelayMs = 2000
): Promise<string | null> {
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const token = await getToken(getMessaging());
      if (token) return token;
      // Empty token — treat like a transient miss and retry.
      lastErr = new Error("getToken() returned empty");
    } catch (err) {
      lastErr = err;
    }

    if (attempt < attempts) {
      const delay = baseDelayMs * 2 ** (attempt - 1); // 2s, 4s, ...
      console.warn(
        `[Push] getToken() attempt ${attempt}/${attempts} failed — retrying in ${delay}ms`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.warn(
    "[Push] getToken() failed after retries:",
    (lastErr as any)?.message || lastErr
  );
  return null;
}

// ─── Backend sync ───────────────────────────────────────────────────────────

/** POST the token to the backend so it can target this device. */
async function sendTokenToServer(token: string): Promise<void> {
  await api.post("/partner/fcm-token", { token, platform: PLATFORM });
  _currentToken = token;
  console.log("[Push] Token registered with backend");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Register this device for push notifications and sync the token to the backend.
 * Safe to call multiple times — the onTokenRefresh listener is only attached once.
 * Must be called while authenticated (the POST requires the auth cookie).
 */
export async function registerPushToken(): Promise<void> {
  try {
    // FCM tokens are not available on simulators/emulators without Play Services.
    if (!Device.isDevice) {
      console.log("[Push] Skipping registration — not a physical device");
      return;
    }

    const granted = await requestNotificationPermission();
    if (!granted) {
      console.log("[Push] Notification permission not granted — skipping");
      return;
    }

    const token = await getTokenWithRetry();
    if (!token) {
      // Registration failed (e.g. FCM/Play Services unavailable or offline).
      // Bail quietly — onTokenRefresh will re-register once FCM recovers.
      console.warn("[Push] No FCM token obtained — skipping registration");
      return;
    }

    await sendTokenToServer(token);

    // Re-register whenever FCM rotates the token. Attach only once.
    if (!_unsubscribeTokenRefresh) {
      _unsubscribeTokenRefresh = onTokenRefresh(getMessaging(), (newToken: string) => {
        console.log("[Push] Token refreshed — re-registering");
        sendTokenToServer(newToken).catch((err) =>
          console.warn("[Push] Re-register after refresh failed:", err?.message || err)
        );
      });
    }
  } catch (err: any) {
    // Never let a push failure break the authenticated flow.
    console.warn("[Push] registerPushToken failed:", err?.message || err);
  }
}

/**
 * Unregister this device on logout: DELETE the token from the backend and
 * tear down the refresh listener. Call this before clearing the auth cookie
 * so the authenticated DELETE request still succeeds.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (_unsubscribeTokenRefresh) {
      _unsubscribeTokenRefresh();
      _unsubscribeTokenRefresh = null;
    }

    // Prefer the token we registered; fall back to querying the current one.
    let token = _currentToken;
    if (!token) {
      try {
        token = await getToken(getMessaging());
      } catch {
        token = null;
      }
    }

    if (token) {
      await api.delete("/partner/fcm-token", {
        data: { token, platform: PLATFORM },
      });
      console.log("[Push] Token removed from backend");
    }
  } catch (err: any) {
    console.warn("[Push] unregisterPushToken failed:", err?.message || err);
  } finally {
    _currentToken = null;
  }
}
