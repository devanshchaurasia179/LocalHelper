/**
 * NotificationsService — Partner App
 *
 * Handles booking and chat push notifications end-to-end:
 *   - Creates the Android notification channels (Notifee).
 *   - Foreground: messaging().onMessage → renders the notification via Notifee.
 *   - Background / quit: setBackgroundMessageHandler, getInitialNotification,
 *     and onNotificationOpenedApp → deep-link to the target screen on tap.
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
import { setPendingBooking } from "@/services/bookingDeepLink";
import { setPendingChat } from "@/services/chatDeepLink";

// ─── Constants ────────────────────────────────────────────────────────────────

export const BOOKING_CHANNEL_ID = "bookings";
const BOOKING_CHANNEL_NAME = "Booking updates";

export const CHAT_CHANNEL_ID = "chat_messages";
const CHAT_CHANNEL_NAME = "Chat messages";

let _unsubscribeOnMessage: (() => void) | null = null;
let _unsubscribeOnOpened: (() => void) | null = null;
let _unsubscribeForegroundEvent: (() => void) | null = null;
let _bookingChannelCreated = false;
let _chatChannelCreated = false;

// ─── Channels ─────────────────────────────────────────────────────────────────

export async function ensureBookingChannel(): Promise<void> {
  if (_bookingChannelCreated) return;
  try {
    await notifee.createChannel({
      id: BOOKING_CHANNEL_ID,
      name: BOOKING_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibration: true,
    });
    _bookingChannelCreated = true;
  } catch (err: any) {
    console.warn("[Notifications] createBookingChannel failed:", err?.message || err);
  }
}

export async function ensureChatChannel(): Promise<void> {
  if (_chatChannelCreated) return;
  try {
    await notifee.createChannel({
      id: CHAT_CHANNEL_ID,
      name: CHAT_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
      sound: "default",
      vibration: true,
    });
    _chatChannelCreated = true;
  } catch (err: any) {
    console.warn("[Notifications] createChatChannel failed:", err?.message || err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type RemoteMessage = FirebaseMessagingTypes.RemoteMessage;

function isBookingMessage(data: RemoteMessage["data"] | undefined): boolean {
  return !!data && data.type === "booking";
}

function isChatMessage(data: RemoteMessage["data"] | undefined): boolean {
  return !!data && data.type === "chat";
}

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

// ─── Booking routing ──────────────────────────────────────────────────────────

function routeBookingTap(data: RemoteMessage["data"] | undefined): void {
  if (!isBookingMessage(data)) return;

  const bookingId = asString(data?.bookingId);
  const action = asString(data?.action);

  if (bookingId) {
    setPendingBooking({ bookingId, action });
  }

  try {
    router.navigate("/(tabs)/bookings" as any);
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

// ─── Chat routing ─────────────────────────────────────────────────────────────

function routeChatTap(data: RemoteMessage["data"] | undefined): void {
  if (!isChatMessage(data)) return;

  const conversationId = asString(data?.conversationId);
  const senderName = asString(data?.senderName);

  if (conversationId) {
    setPendingChat({ conversationId, senderName });
  }

  try {
    if (conversationId) {
      router.navigate(`/(tabs)/chat/${conversationId}` as any);
    } else {
      router.navigate("/(tabs)/chat" as any);
    }
  } catch (err: any) {
    console.warn("[Notifications] navigate to chat failed:", err?.message || err);
  }
}

async function displayChatNotification(message: RemoteMessage): Promise<void> {
  if (!isChatMessage(message.data)) return;

  await ensureChatChannel();

  const senderName = asString(message.data?.senderName) ?? "Someone";
  const messageText = asString(message.data?.messageText) ?? "";
  const conversationId = asString(message.data?.conversationId);

  await notifee.displayNotification({
    // Group by conversation so rapid messages collapse into one entry.
    id: conversationId ? `chat_${conversationId}` : undefined,
    title: `${senderName} sent you a message`,
    body: messageText,
    data: message.data,
    android: {
      channelId: CHAT_CHANNEL_ID,
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
  ensureChatChannel();

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

      // Foreground chat: display the notification so the user can tap into it
      // even while the app is open (they may be on a different screen).
      if (type === "chat") {
        displayChatNotification(message).catch((err) =>
          console.warn("[Notifications] chat display failed:", err?.message || err)
        );
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
        const data = detail.notification?.data as RemoteMessage["data"];
        if (data?.type === "chat") {
          routeChatTap(data);
        } else {
          routeBookingTap(data);
        }
      }
    });
  }

  if (!_unsubscribeOnOpened) {
    _unsubscribeOnOpened = getMessaging().onNotificationOpenedApp((message) => {
      const data = message?.data;
      if (data?.type === "chat") {
        routeChatTap(data);
      } else {
        routeBookingTap(data);
      }
    });
  }

  getMessaging()
    .getInitialNotification()
    .then((message) => {
      if (!message) return;
      const data = message.data;
      if (data?.type === "chat") {
        routeChatTap(data);
      } else {
        routeBookingTap(data);
      }
    })
    .catch((err) =>
      console.warn("[Notifications] getInitialNotification failed:", err?.message || err)
    );
}
