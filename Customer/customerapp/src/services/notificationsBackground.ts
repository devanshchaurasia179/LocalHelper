/**
 * notificationsBackground — Customer App
 *
 * Registers the FCM background/quit message handler and the Notifee background
 * event handler at module scope (before React renders).
 *
 * Handles:
 *   - incoming_call  → posts a high-priority call notification so the user
 *                      sees an alert even when the app is backgrounded. Stores
 *                      the call payload in callDeepLink so useCallManager can
 *                      show the IncomingCallModal when the app foregrounds.
 *   - call_cancel    → cancels any displayed call notification.
 *   - booking        → posts a booking notification for later deep-link.
 *   - chat           → posts a chat notification; on tap navigates to the
 *                      conversation screen via chatDeepLink.
 */

import notifee, {
  AndroidImportance,
  EventType,
  type Event,
} from "@notifee/react-native";
import {
  getMessaging,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import {
  BOOKING_CHANNEL_ID,
  CHAT_CHANNEL_ID,
  ensureBookingChannel,
  ensureChatChannel,
} from "@/services/notifications";
import { setPendingBooking } from "@/services/bookingDeepLink";
import { setPendingCall } from "@/services/callDeepLink";
import { setPendingChat } from "@/services/chatDeepLink";

// ─── Channels ─────────────────────────────────────────────────────────────────

export const CALL_CHANNEL_ID = "incoming_calls";

async function ensureCallChannel(): Promise<void> {
  await notifee.createChannel({
    id: CALL_CHANNEL_ID,
    name: "Incoming calls",
    importance: AndroidImportance.HIGH,
    sound: "default",
    vibration: true,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isBooking = (data: RemoteMessage["data"] | undefined): boolean =>
  !!data && data.type === "booking";

const isChat = (data: RemoteMessage["data"] | undefined): boolean =>
  !!data && data.type === "chat";

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

// Stable tag so we can cancel the call notification when call_cancel arrives.
const callNotificationId = (callId: string) => `call_${callId}`;

// ─── Background message handler ───────────────────────────────────────────────

setBackgroundMessageHandler(getMessaging(), async (message) => {
  const data = message.data;
  const type = asString(data?.type);

  // ── Incoming call ──────────────────────────────────────────────────────────
  if (type === "incoming_call") {
    const callId = asString(data?.callId);
    if (!callId) return;

    const callerName = asString(data?.callerName) ?? "Local Helpers";
    const callerId = asString(data?.callerId) ?? "";
    const roomName = asString(data?.roomName) ?? "";

    // Store so useCallManager can show IncomingCallModal when app foregrounds.
    setPendingCall({ callId, roomName, callerName, callerId });

    await ensureCallChannel();
    await notifee.displayNotification({
      id: callNotificationId(callId),
      title: "Incoming Call",
      body: `${callerName} is calling you`,
      data: { type: "incoming_call", callId, callerName, callerId, roomName },
      android: {
        channelId: CALL_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: "default" },
        smallIcon: "ic_launcher",
        ongoing: false,
        sound: "default",
        vibrationPattern: [300, 500, 300, 500],
      },
    });
    return;
  }

  // ── Cancel / dismiss call notification ────────────────────────────────────
  if (type === "call_cancel") {
    const callId = asString(data?.callId);
    if (callId) {
      await notifee.cancelNotification(callNotificationId(callId));
    }
    return;
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  if (isChat(data)) {
    const conversationId = asString(data?.conversationId);
    const senderName = asString(data?.senderName) ?? "Someone";
    const messageText = asString(data?.messageText) ?? "";

    await ensureChatChannel();
    await notifee.displayNotification({
      // Group by conversation so back-to-back messages don't stack.
      id: conversationId ? `chat_${conversationId}` : undefined,
      title: `${senderName} sent you a message`,
      body: messageText,
      data,
      android: {
        channelId: CHAT_CHANNEL_ID,
        importance: AndroidImportance.HIGH,
        pressAction: { id: "default" },
        smallIcon: "ic_launcher",
        sound: "default",
      },
    });
    return;
  }

  // ── Booking ───────────────────────────────────────────────────────────────
  if (!isBooking(data)) return;

  await ensureBookingChannel();

  const title =
    message.notification?.title ??
    (typeof data?.title === "string" ? data.title : "Booking update");
  const body =
    message.notification?.body ??
    (typeof data?.body === "string" ? data.body : "");

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
});

// ─── Background tap handler ───────────────────────────────────────────────────

notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
  if (type !== EventType.PRESS) return;

  const data = detail.notification?.data as RemoteMessage["data"] | undefined;
  const msgType = asString(data?.type);

  // Call notification tapped — callDeepLink already has the payload from when
  // it was stored in setBackgroundMessageHandler. Nothing extra needed here;
  // useCallManager drains it via subscribePendingCall / consumePendingCall.
  if (msgType === "incoming_call") return;

  // Chat notification tapped — store the conversationId for the chat screen
  // to consume on mount/focus.
  if (msgType === "chat") {
    const conversationId = asString(data?.conversationId);
    const senderName = asString(data?.senderName);
    if (conversationId) setPendingChat({ conversationId, senderName });
    return;
  }

  // Booking notification tapped.
  if (!isBooking(data)) return;
  const bookingId = asString(data?.bookingId);
  const action = asString(data?.action);
  if (bookingId) setPendingBooking({ bookingId, action });
});
