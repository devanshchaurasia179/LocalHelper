/**
 * chatDeepLink — Partner App
 *
 * A tiny module-level store that bridges a tapped chat push notification to
 * the conversation screen. When the app is backgrounded or killed and the
 * user taps a "New message" notification, the app foregrounds and the chat
 * tab drains this store to navigate directly to the right conversation.
 *
 * Flow:
 *   - FCM delivers a `type: "chat"` message while the app is backgrounded.
 *   - notificationsBackground posts a Notifee notification and stores the
 *     conversationId here via setPendingChat().
 *   - onBackgroundEvent (PRESS) or onNotificationOpenedApp navigates to the
 *     Chat tab; the conversation screen consumes the pending conversationId
 *     on mount via consumePendingChat().
 *   - In the foreground, notifications.ts calls setPendingChat() + navigates
 *     directly (the listener fires immediately for an already-mounted screen).
 */

export type PendingChat = {
  conversationId: string;
  senderName?: string;
};

let _pending: PendingChat | null = null;
const _listeners = new Set<(pending: PendingChat) => void>();

/** Store a chat to open and notify any live listener immediately. */
export function setPendingChat(pending: PendingChat): void {
  _pending = pending;
  _listeners.forEach((fn) => {
    try {
      fn(pending);
    } catch {
      // A misbehaving listener must never break notification handling.
    }
  });
}

/** Read and clear the pending chat (returns null if none). */
export function consumePendingChat(): PendingChat | null {
  const p = _pending;
  _pending = null;
  return p;
}

/**
 * Subscribe to pending-chat events. Returns an unsubscribe function.
 * Use in the chat list screen so a tap while it is already focused
 * routes immediately instead of waiting for the next focus cycle.
 */
export function subscribePendingChat(
  listener: (pending: PendingChat) => void
): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
