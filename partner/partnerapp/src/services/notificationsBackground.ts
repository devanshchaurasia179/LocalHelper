/**
 * notificationsBackground — Partner App
 *
 * Registers the FCM background/quit message handler and the Notifee background
 * event handler. These MUST run at module scope (before React renders), so this
 * file is imported for its side-effects from the app's root layout.
 *
 * Responsibilities:
 *   - setBackgroundMessageHandler: fired when a data/notification message
 *     arrives while the app is backgrounded or quit. For booking messages we
 *     display a Notifee notification so the tap can later deep-link.
 *   - notifee.onBackgroundEvent: fired when the user taps a Notifee
 *     notification while the app is backgrounded. We stash the booking target
 *     so the Bookings screen deep-links once the app is opened.
 *
 * Handles two message families in the background/quit state:
 *   - data.type === 'booking'       → Notifee notification for later deep-link.
 *   - data.type === 'incoming_call' → native CallKeep incoming-call UI (so a
 *                                     locked device shows the ringing screen).
 *   - data.type === 'call_cancel'   → dismiss the native CallKeep UI.
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
  ensureBookingChannel,
} from "@/services/notifications";
import { setPendingBooking } from "@/services/bookingDeepLink";
import {
  setupCallKeep,
  displayIncomingCall,
  endIncomingCall,
} from "@/services/callkeep";

const isBooking = (data: RemoteMessage["data"] | undefined): boolean =>
  !!data && data.type === "booking";

const asString = (v: unknown): string | undefined =>
  typeof v === "string" ? v : undefined;

// FCM background/quit handler. Call messages take priority (time-sensitive),
// then booking messages fall through to the Notifee path.
setBackgroundMessageHandler(getMessaging(), async (message) => {
  const data = message.data;
  const type = asString(data?.type);

  // ─── Native incoming call ──────────────────────────────────────────────
  if (type === "incoming_call") {
    const callId = asString(data?.callId);
    if (!callId) return;
    const callerName = asString(data?.callerName) ?? "Local Helpers";
    // setup() must run before displayIncomingCall in the headless context.
    await setupCallKeep();
    displayIncomingCall(callId, callerName);
    return;
  }

  // ─── Cancel / dismiss native call UI ───────────────────────────────────
  if (type === "call_cancel") {
    const callId = asString(data?.callId);
    if (callId) endIncomingCall(callId);
    return;
  }

  if (!isBooking(data)) return;

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
    },
  });
});

// Notifee background tap handler — stash the target; the Bookings screen picks
// it up when the app is opened. Navigation itself happens from a mounted screen.
notifee.onBackgroundEvent(async ({ type, detail }: Event) => {
  if (type !== EventType.PRESS) return;

  const data = detail.notification?.data as RemoteMessage["data"] | undefined;
  if (!isBooking(data)) return;

  const bookingId = typeof data?.bookingId === "string" ? data.bookingId : undefined;
  const action = typeof data?.action === "string" ? data.action : undefined;
  if (bookingId) setPendingBooking({ bookingId, action });
});
