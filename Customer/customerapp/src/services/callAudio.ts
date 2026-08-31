/**
 * callAudio — Customer App
 *
 * Thin wrapper over react-native-incall-manager for audio routing during a
 * call. LiveKit's AudioSession still manages the WebRTC audio session inside
 * the call screen; InCallManager complements it by owning the device-level
 * routing (earpiece vs speaker, proximity sensor, wired-headset detection)
 * from the moment the call is answered until it ends.
 *
 * Both are safe to run together: InCallManager sets the Android audio mode to
 * MODE_IN_COMMUNICATION and routes to the earpiece by default, which matches
 * LiveKit's configureAudio() intent.
 */

import InCallManager from 'react-native-incall-manager';

let _active = false;

/** Begin call-audio routing (earpiece by default, proximity sensor on). */
export function startCallAudio(): void {
  if (_active) return;
  _active = true;
  try {
    InCallManager.start({ media: 'audio', auto: true });
    InCallManager.setForceSpeakerphoneOn(false);
  } catch (err: any) {
    _active = false;
    console.warn('[callAudio] start failed:', err?.message || err);
  }
}

/** Route audio to the loudspeaker or back to the earpiece. */
export function setSpeaker(on: boolean): void {
  try {
    InCallManager.setForceSpeakerphoneOn(on);
    InCallManager.setSpeakerphoneOn(on);
  } catch (err: any) {
    console.warn('[callAudio] setSpeaker failed:', err?.message || err);
  }
}

/** Stop call-audio routing and restore normal audio mode. */
export function stopCallAudio(): void {
  if (!_active) return;
  _active = false;
  try {
    InCallManager.stop();
  } catch (err: any) {
    console.warn('[callAudio] stop failed:', err?.message || err);
  }
}
