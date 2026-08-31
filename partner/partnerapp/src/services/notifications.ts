/**
 * NotificationsService — Partner App
 *
 * Handles booking push notifications end-to-end:
 *   - Creates the Android notification channel (Notifee).
 *   - Foreground: messaging().onMessage → renders the notification via Notifee
 *     (FCM does NOT show a system notification while the app is in the
 *     foreground, so we display it ourselves).
 *   - Background / quit: setBackgroundMessageHandler (registered at app entry),
 *     getInitialNotification, and onNotificationOpenedApp → when a booking
 *     notification is TAPPED, deep-link to the Bookings screen for that booking.
 *
 * Scope: only messages with data.type === 'booking' are handled here. Call
 * messages (type 'incoming_call' / 'call_cancel') are intentionally ignored
 * and left for the call-handling task.
 *
 * Everything is defensive — a notification failure must never crash the app.
 */

import { router } from "expo-router";
import notifee, {
  AndroidImportance,
  EventType,
  type Event,
} from "@notifee/react-native";
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { ROUTES } from "@/constants/routes";
import { setPendingBooking } from "@/services/bookingDeepLink";
import {
  setupCallKeep,
  displayIncomingCall,
  endIncomingCall,
} from "@/services/callkeep";

// ─── Constants ────────────────────────────────────────────────────────────────

export const BOOKING_CHANNEL_ID = "bookings";
const BOOKING_CHANNEL_NAME = "Booking updates";

// Guards so we only ever attach the foreground listeners once.
let _unsubscribeOnMessage: (() => void) | null = null;
let _unsubscribeOnOpened: (() => void) | null = null;
let _unsubscribeForegroundEvent: (() => void) | null = null;
let _channelCreated = false;

// ─── Channel ──────────────────────────────────────────────────────────────────

/** Create the Android channel booking notifications are posted to. Idempotent. */
export async function ensureBookingChannel(): Promise<void> {
  if (_channelCreated) return;
  try {
    await notifee.createChannel({
      id: BOOKING_CHANNEL_ID,
      name: BOOKING_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
    });
    _channelCreated = true;
  } catch (err: any) {
    console.warn("[Notifications] createChannel failed:", err?.message || err);
  }
}

// ─── Payload helpers ────────────────────────────────────────────────────────

/** True only for booking data messages. Call messages are handled separately. */
function isBookingMessage(data: RemoteMessage["data"] | undefined): boolean {
  return !!data && data.type === "booking";
}

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

/**
 * Foreground call-message handling. Even in the foreground we drive the native
 * CallKeep UI from the FCM push so behaviour is identical everywhere and the
 * app has a single source of truth for the ringing UI. useCallManager
 * de-duplicates the socket `incoming_call` against CallKeep by callId, so the
 * JS IncomingCallModal is suppressed while CallKeep is showing this call.
 *
 * Returns true if the message was a call message (and therefore handled here).
 */
function handleCallMessage(data: RemoteMessage["data"] | undefined): boolean {
  const type = asString(data?.type);

  if (type === "incoming_call") {
    const callId = asString(data?.callId);
    if (callId) {
      const callerName = asString(data?.callerName) ?? "Local Helpers";
      setupCallKeep()
        .then(() => displayIncomingCall(callId, callerName))
        .catch((err) =>
          console.warn("[Notifications] CallKeep display failed:", err?.message || err)
        );
    }
    return true;
  }

  if (type === "call_cancel") {
    const callId = asString(data?.callId);
    if (callId) endIncomingCall(callId);
    return true;
  }

  return false;
}

/**
 * Route to the Bookings screen for a tapped booking notification.
 * We stash the target in the deep-link store first (so the screen can reveal
 * the right booking), then navigate to the Bookings tab.
 */
function routeBookingTap(data: RemoteMessage["data"] | undefined): void {
  if (!isBookingMessage(data)) return;

  const bookingId = typeof data?.bookingId === "string" ? data.bookingId : undefined;
  const action = typeof data?.action === "string" ? data.action : undefined;

  if (bookingId) {
    setPendingBooking({ bookingId, action });
  }

  try {
    router.navigate(ROUTES.APP.BOOKINGS as any);
  } catch (err: any) {
    console.warn("[Notifications] navigate to bookings failed:", err?.message || err);
  }
}

// ─── Foreground display ─────────────────────────────────────────────────────

/** Render an incoming booking message as a local notification via Notifee. */
async function displayBookingNotification(message: RemoteMessage): Promise<void> {
  if (!isBookingMessage(message.data)) return;

  await ensureBookingChannel();

  const title =
    message.notification?.title ??
    (typeof message.data?.title === "string" ? message.data.title : "Booking update");
  const body =
    message.notification?.body ??
    (typeof message.data?.body === "string" ? message.data.body : "");

  await notifee.displayNotification({
    title,
    body,
    // Carry the FCM data through so the tap handler can deep-link.
    data: message.data,
    android: {
      channelId: BOOKING_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: "default" },
      smallIcon: "ic_launcher",
    },
  });
}

// ─── Public init ────────────────────────────────────────────────────────────

/**
 * Initialise foreground notification handling. Safe to call multiple times.
 * Attaches:
 *   - messaging().onMessage           → display booking notifications in-app
 *   - notifee.onForegroundEvent       → handle taps on those in-app notifications
 *   - messaging().onNotificationOpenedApp → tap that brought the app from background
 * and checks getInitialNotification for a tap that cold-started the app.
 */
export function initNotifications(): void {
  ensureBookingChannel();

  const messaging = getMessaging();

  if (!_unsubscribeOnMessage) {
    _unsubscribeOnMessage = onMessage(messaging, (message) => {
      // Call messages drive the native CallKeep UI and short-circuit here.
      if (handleCallMessage(message.data)) return;
      displayBookingNotification(message).catch((err) =>
        console.warn("[Notifications] display failed:", err?.message || err)
      );
    });
  }

  // Taps on the Notifee notification we displayed while in the foreground.
  if (!_unsubscribeForegroundEvent) {
    _unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }: Event) => {
      if (type === EventType.PRESS) {
        routeBookingTap(detail.notification?.data as RemoteMessage["data"]);
      }
    });
  }

  // Tap on a system notification that brought the app from background → foreground.
  if (!_unsubscribeOnOpened) {
    _unsubscribeOnOpened = onNotificationOpenedApp(messaging, (message) => {
      routeBookingTap(message?.data);
    });
  }

  // Tap on a system notification that cold-started the app from a quit state.
  getInitialNotification(messaging)
    .then((message) => {
      if (message) routeBookingTap(message.data);
    })
    .catch((err) =>
      console.warn("[Notifications] getInitialNotification failed:", err?.message || err)
    );
}
