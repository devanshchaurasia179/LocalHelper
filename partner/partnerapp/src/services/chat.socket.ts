/**
 * ChatSocketService
 *
 * Manages the Socket.IO connection to the /chat namespace.
 *
 * ── Why a service singleton instead of a hook? ────────────────────────────────
 * The socket must persist across screen navigations. A singleton ensures only
 * one connection is ever open, regardless of how many components mount/unmount.
 *
 * ── Auth ─────────────────────────────────────────────────────────────────────
 * React Native cannot forward httpOnly cookies over a WebSocket handshake.
 * Before connecting we call GET /api/chat/socket-token to exchange the cookie
 * for a short-lived JWT, then pass it in socket.handshake.auth.token.
 *
 * ── Socket URL ────────────────────────────────────────────────────────────────
 * The Vercel proxy does NOT support WebSocket. We connect directly to the
 * backend (EXPO_PUBLIC_SOCKET_URL or EXPO_PUBLIC_DIRECT_UPLOAD_URL stripped
 * of the /api suffix).
 */

import { io, Socket } from "socket.io-client";
import Constants from "expo-constants";
import { getSocketToken } from "@/api/chat.api";

// ─── Resolve the WebSocket URL ────────────────────────────────────────────────

const devHost =
  Constants.expoConfig?.hostUri?.split(":")[0] ?? "localhost";

/**
 * Priority:
 * 1. EXPO_PUBLIC_SOCKET_URL  (set this in .env to point directly at the backend)
 * 2. EXPO_PUBLIC_DIRECT_UPLOAD_URL stripped of "/api" suffix
 * 3. http://<dev-host>:5001  (local dev fallback)
 */
export const SOCKET_BASE_URL: string = (() => {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;

  const direct = process.env.EXPO_PUBLIC_DIRECT_UPLOAD_URL;
  if (direct) return direct.replace(/\/api$/, "");

  return `http://${devHost}:5001`;
})();

console.log("[ChatSocket] Base URL:", SOCKET_BASE_URL);

// ─── Singleton state ──────────────────────────────────────────────────────────

let _socket: Socket | null = null;
let _connecting = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect (or return the existing socket — connected or reconnecting).
 * Fetches a fresh socket-token from the server on every NEW connection only.
 *
 * Never rejects — always resolves with the socket instance so callers can
 * attach listeners immediately. Socket.IO handles reconnection internally.
 */
export async function connectChatSocket(): Promise<Socket> {
  // Return existing socket regardless of connected state — Socket.IO will
  // reconnect automatically; listeners survive reconnects on the same instance.
  if (_socket) return _socket;

  // Guard against concurrent calls
  if (_connecting) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (_socket) {
          clearInterval(check);
          resolve(_socket);
        } else if (!_connecting) {
          clearInterval(check);
          reject(new Error("Socket connection failed"));
        }
      }, 100);
    });
  }

  _connecting = true;

  try {
    const { data } = await getSocketToken();
    const { token } = data;

    _socket = io(`${SOCKET_BASE_URL}/chat`, {
      auth: { token },
      // Websocket-only — skips the polling handshake that breaks on AWS ELB
      // without sticky sessions. A single persistent WS connection is also
      // faster and more reliable on mobile networks.
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    // Wait for first connection attempt — resolve either way so the caller
    // always gets the socket back and can attach listeners.
    await new Promise<void>((resolve) => {
      const onConnect = () => {
        console.log("[ChatSocket] Connected:", _socket?.id);
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        console.warn("[ChatSocket] Initial connect_error (will retry):", err.message);
        cleanup();
        resolve(); // don't reject — let reconnection handle it
      };
      const cleanup = () => {
        _socket?.off("connect", onConnect);
        _socket?.off("connect_error", onError);
      };

      const timeout = setTimeout(() => {
        console.warn("[ChatSocket] Initial connection timeout — continuing with reconnects");
        cleanup();
        resolve();
      }, 15000);

      _socket!.once("connect", () => { clearTimeout(timeout); onConnect(); });
      _socket!.once("connect_error", (err) => { clearTimeout(timeout); onError(err); });
    });

    return _socket;
  } finally {
    _connecting = false;
  }
}

/**
 * Disconnect the socket and clean up.
 * Call this when the user logs out.
 */
export function disconnectChatSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
    console.log("[ChatSocket] Disconnected");
  }
  _connecting = false;
}

/**
 * Get the current socket instance, or null if never connected.
 * The socket may be reconnecting — use getConnectedSocket() for sends.
 */
export function getChatSocket(): Socket | null {
  return _socket;
}

/**
 * Get the socket only if it is currently connected.
 * Use for fire-and-forget emits (typing, send_message).
 */
export function getConnectedSocket(): Socket | null {
  return _socket?.connected ? _socket : null;
}
