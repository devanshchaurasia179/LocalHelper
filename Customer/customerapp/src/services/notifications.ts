/**
 * NotificationsService — Customer App
 *
 * Handles booking push notifications end-to-end:
 *   - Creates the Android notification channel (Notifee).
 *   - Foreground: messaging().onMessage → renders the notification via Notifee.
 *   - Background / quit: setBackgroundMessageHandler, getInitialNotification,
 *     and onNotificationOpenedApp → deep-link to the Bookings screen on tap.
 *
 * Call messages (incoming_call / call_cancel) are handled by the socket-based
 * useCallManager. In the foreground we also cancel any stale call notification
 * that was posted during a brief background period.
 */

import { router } from "expo-router";
import notifee, {
  AndroidImportance,
  EventType,
  type Event,
} from "@notifee/react-native";
import { getMessaging, type FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { ROUTES } from "@/constants/routes";
import { setPendingBooking } from "@/services/bookingDeepLink";

// ─── Constants ────────────────────────────────────────────────────────────────

export const BOOKING_CHANNEL_ID = "bookings";
const BOOKING_CHANNEL_NAME = "Booking updates";

let _unsubscribeOnMessage: (() => void) | null = null;
let _unsubscribeOnOpened: (() => void) | null = null;
let _unsubscribeForegroundEvent: (() => void) | null = null;
let _channelCreated = false;

// ─── Channel ─────────────────────────────────────────────────────────────────

export async function ensureBookingChannel(): Promise<void> {
  if (_channelCreated) return;
  try {
    await notifee.createChannel({
      id: BOOKING_CHANNEL_ID,
      name: BOOKING_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibration: true,
    });
    _channelCreated = true;
  } catch (err: any) {
    console.warn("[Notifications] createChannel failed:", err?.message || err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

function isBookingMessage(data: RemoteMessage["data"] | undefined): boolean {
  return !!data && data.type === "booking";
}

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

function routeBookingTap(data: RemoteMessage["data"] | undefined): void {
  if (!isBookingMessage(data)) return;

  const bookingId = asString(data?.bookingId);
  const action = asString(data?.action);

  if (bookingId) {
    setPendingBooking({ bookingId, action });
  }

  try {
    router.navigate(ROUTES.APP.BOOKINGS as any);
  } catch (err: any) {
    console.warn("[Notifications] navigate to bookings failed:", err?.message || err);
  }
}

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
    data: message.data,
    android: {
      channelId: BOOKING_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: "default" },
      smallIcon: "ic_launcher",
      sound: "default",
    },
  });
}

// ─── Public init ─────────────────────────────────────────────────────────────

export function initNotifications(): void {
  ensureBookingChannel();

  if (!_unsubscribeOnMessage) {
    _unsubscribeOnMessage = getMessaging().onMessage((message) => {
      const type = message.data?.type;

      // Foreground: socket drives the IncomingCallModal directly.
      // Cancel any stale call notification posted during a brief background.
      if (type === "incoming_call") {
        const callId = asString(message.data?.callId);
        if (callId) notifee.cancelNotification(`call_${callId}`).catch(() => {});
        return;
      }

      if (type === "call_cancel") {
        const callId = asString(message.data?.callId);
        if (callId) notifee.cancelNotification(`call_${callId}`).catch(() => {});
        return;
      }

      displayBookingNotification(message).catch((err) =>
        console.warn("[Notifications] display failed:", err?.message || err)
      );
    });
  }

  if (!_unsubscribeForegroundEvent) {
    _unsubscribeForegroundEvent = notifee.onForegroundEvent(({ type, detail }: Event) => {
      if (type === EventType.PRESS) {
        routeBookingTap(detail.notification?.data as RemoteMessage["data"]);
      }
    });
  }

  if (!_unsubscribeOnOpened) {
    _unsubscribeOnOpened = getMessaging().onNotificationOpenedApp((message) => {
      routeBookingTap(message?.data);
    });
  }

  getMessaging()
    .getInitialNotification()
    .then((message) => {
      if (message) routeBookingTap(message.data);
    })
    .catch((err) =>
      console.warn("[Notifications] getInitialNotification failed:", err?.message || err)
    );
}
