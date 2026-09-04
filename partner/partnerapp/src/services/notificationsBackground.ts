/**
 * notificationsBackground — Partner App
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

// v2 channel uses the custom ringtone.mp3 bundled at res/raw/ringtone.mp3.
// Android notification channels are immutable once created — a new ID is
// required to change the sound from the old "default" channel.
export const CALL_CHANNEL_ID = "incoming_calls_v2";

async function ensureCallChannel(): Promise<void> {
  await notifee.createChannel({
    id: CALL_CHANNEL_ID,
    name: "Incoming calls",
    importance: AndroidImportance.HIGH,
    // "ringtone" refers to android/app/src/main/res/raw/ringtone.mp3
    sound: "ringtone",
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const isBooking = (data: RemoteMessage["data"] | undefined): boolean =>
  !!data && data.type === "booking";

const isChat = (data: RemoteMessage["data"] | undefined): boolean =>
  !!data && data.type === "chat";

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

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

    // When the app is KILLED, FCM delivers the notification block from the
    // backend directly and may display a system notification before the JS
    // engine even starts. We still call notifee.displayNotification() so the
    // notification uses our channel (with the custom ringtone) and our exact
    // press action — this replaces the FCM-rendered one via the same `id`.
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
        // "ringtone" maps to android/app/src/main/res/raw/ringtone.mp3
        sound: "ringtone",
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
    const senderName = asString(data?.senderName) ?? "New message";
    const messageText = asString(data?.messageText) ?? "";

    await ensureChatChannel();
    await notifee.displayNotification({
      // Group by conversation so back-to-back messages don't stack.
      id: conversationId ? `chat_${conversationId}` : undefined,
      title: senderName,
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

  // Call notification tapped — payload already in callDeepLink store.
  if (msgType === "incoming_call") return;

  // Chat notification tapped — store the conversationId for the chat screen
  // to consume on mount/focus.
  if (msgType === "chat") {
    const conversationId = asString(data?.conversationId);
    const senderName = asString(data?.senderName);
    if (conversationId) setPendingChat({ conversationId, senderName });
    return;
  }

  if (!isBooking(data)) return;
  const bookingId = asString(data?.bookingId);
  const action = asString(data?.action);
  if (bookingId) setPendingBooking({ bookingId, action });
});
