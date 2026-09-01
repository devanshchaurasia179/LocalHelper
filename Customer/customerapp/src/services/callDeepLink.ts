/**
 * callDeepLink — Customer App
 *
 * Module-level store that bridges a tapped "Incoming Call" push notification
 * to useCallManager. When the app is backgrounded and the user taps the
 * call notification, the app foregrounds and useCallManager drains this store
 * to show the IncomingCallModal.
 *
 * Flow:
 *   - FCM background handler receives incoming_call data push.
 *   - It posts a Notifee notification and stores the call payload here.
 *   - notifee.onBackgroundEvent (PRESS) marks the tap so useCallManager
 *     knows to pop the modal immediately on next mount.
 *   - useCallManager calls consumePendingCall() on mount to drain any
 *     call that arrived while the app was backgrounded.
 */

export type PendingCall = {
  callId: string;
  roomName: string;
  callerName: string;
  callerId: string;
};

let _pending: PendingCall | null = null;
const _listeners = new Set<(pending: PendingCall) => void>();

/** Store a call payload and notify any live listener immediately. */
export function setPendingCall(pending: PendingCall): void {
  _pending = pending;
  _listeners.forEach((fn) => {
    try { fn(pending); } catch { /* never break notification handling */ }
  });
}

/** Read and clear the pending call (returns null if none). */
export function consumePendingCall(): PendingCall | null {
  const p = _pending;
  _pending = null;
  return p;
}

/** Subscribe to pending call events. Returns an unsubscribe function. */
export function subscribePendingCall(
  listener: (pending: PendingCall) => void
): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}
