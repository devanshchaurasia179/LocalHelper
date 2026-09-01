/**
 * callkeep — Partner App (stub)
 *
 * react-native-callkeep has been removed. This stub preserves the same API so
 * all existing imports compile without changes. Every function is a no-op or
 * returns a safe default; the in-app JS modal / CallScreen handle all call UI.
 */

export function isCallKeepActive(_callId: string): boolean {
  return false;
}

export async function setupCallKeep(): Promise<void> {
  // no-op
}

export function displayIncomingCall(_callId: string, _callerName: string): boolean {
  return false; // always fall back to JS modal
}

export function endIncomingCall(_callId: string): void {
  // no-op
}

export function setCallConnected(_callId: string): void {
  // no-op
}
