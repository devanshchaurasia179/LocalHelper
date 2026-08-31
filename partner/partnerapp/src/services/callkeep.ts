/**
 * callkeep — Partner App
 *
 * Renders native incoming-call UI (lock-screen / full-screen) via
 * react-native-callkeep, driven by FCM data pushes.
 *
 * Responsibilities:
 *   - setupCallKeep(): one-time RNCallKeep.setup() (+ Android ConnectionService
 *     registration). Safe to call multiple times; only the first runs.
 *   - displayIncomingCall(): show the native ringing UI for a callId. Tracks the
 *     callId so we can de-duplicate against the socket `incoming_call` event and
 *     avoid rendering the JS IncomingCallModal at the same time.
 *   - endIncomingCall(): dismiss the native UI for a callId.
 *   - The CallKeep event listeners (answerCall / endCall) are attached ONCE and
 *     forwarded to a lightweight in-process emitter (callBridge) that
 *     useCallManager subscribes to — because these events fire outside React
 *     (including when the app was woken from a quit/background state).
 *
 * The callId (a Mongo ObjectId string) is used directly as the CallKeep call
 * UUID. Android's self-managed ConnectionService accepts an arbitrary string,
 * and CallKeep echoes the same value back in its events, so no mapping table is
 * needed.
 */

import RNCallKeep from 'react-native-callkeep';
import { Platform } from 'react-native';
import { callBridge } from '@/services/callBridge';

const CALLKEEP_OPTIONS = {
  ios: {
    appName: 'LocalHelpers Partner',
    supportsVideo: false,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
  },
  android: {
    alertTitle: 'Permissions required',
    alertDescription:
      'This application needs to access your phone accounts to receive calls',
    cancelButton: 'Cancel',
    okButton: 'OK',
    additionalPermissions: [],
    foregroundService: {
      channelId: 'com.localhelpers.partner.callkeep',
      channelName: 'Incoming calls',
      notificationTitle: 'Call in progress',
      notificationIcon: 'ic_launcher',
    },
    selfManaged: true,
  },
} as const;

// De-dup registry: callIds we've asked CallKeep to display and not yet ended.
const displayedCalls = new Set<string>();

let _setup = false;
let _listenersAttached = false;

/** True if the native incoming-call UI is currently showing for this callId. */
export function isCallKeepActive(callId: string): boolean {
  return displayedCalls.has(callId);
}

/**
 * One-time CallKeep setup. Registers the phone account / ConnectionService and
 * attaches the native event listeners. Idempotent and never throws.
 */
export async function setupCallKeep(): Promise<void> {
  if (_setup) {
    attachListeners();
    return;
  }

  try {
    await RNCallKeep.setup(CALLKEEP_OPTIONS as any);
    if (Platform.OS === 'android') {
      RNCallKeep.setAvailable(true);
    }
    _setup = true;
    attachListeners();
  } catch (err: any) {
    console.warn('[CallKeep] setup failed:', err?.message || err);
  }
}

/** Attach the native call-action listeners exactly once. */
function attachListeners(): void {
  if (_listenersAttached) return;
  _listenersAttached = true;

  // User tapped "Answer" on the native UI.
  RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
    const callId = callUUID;
    RNCallKeep.setCurrentCallActive(callUUID);
    callBridge.emit('answer', { callId });
  });

  // User tapped "Decline"/"Hang up" on the native UI, or the OS ended the call.
  RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
    const callId = callUUID;
    const wasDisplayed = displayedCalls.delete(callId);
    callBridge.emit('end', { callId, wasRinging: wasDisplayed });
  });

  RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ callUUID, muted }) => {
    callBridge.emit('mute', { callId: callUUID, muted });
  });
}

/**
 * Show the native incoming-call UI for a call. Records the callId for de-dup.
 * Safe to call from the headless FCM background handler.
 *
 * Returns true if the native UI was requested, false if it could not be shown
 * (e.g. CallKeep/ConnectionService unavailable). Callers in the foreground can
 * use the return value to fall back to the in-app JS modal so a call is never
 * silently dropped.
 */
export function displayIncomingCall(callId: string, callerName: string): boolean {
  if (!callId) return false;
  if (displayedCalls.has(callId)) return true; // already showing — de-dup
  try {
    RNCallKeep.displayIncomingCall(
      callId,
      callerName || 'Local Helpers',
      callerName || 'Local Helpers',
      'generic',
      false,
    );
    displayedCalls.add(callId);
    return true;
  } catch (err: any) {
    console.warn('[CallKeep] displayIncomingCall failed:', err?.message || err);
    return false;
  }
}

/** Dismiss the native UI for a call (on cancel / accept-elsewhere / end). */
export function endIncomingCall(callId: string): void {
  if (!callId) return;
  displayedCalls.delete(callId);
  try {
    RNCallKeep.endCall(callId);
  } catch (err: any) {
    console.warn('[CallKeep] endCall failed:', err?.message || err);
  }
}

/** Mark a displayed call as connected (stops the ringing state natively). */
export function setCallConnected(callId: string): void {
  if (!callId) return;
  try {
    RNCallKeep.setCurrentCallActive(callId);
  } catch {
    // non-fatal
  }
}
