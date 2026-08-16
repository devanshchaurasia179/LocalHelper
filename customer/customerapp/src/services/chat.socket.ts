/**
 * ChatSocketService — Customer App
 *
 * Same design as the partner app's socket service.
 * Manages Socket.IO connection to /chat namespace with cookie → JWT exchange.
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
 * 2. EXPO_PUBLIC_BACKEND_URL stripped of "/api" — only if NOT a vercel.app URL
 * 3. http://<dev-host>:5001  (local dev fallback)
 */
export const SOCKET_BASE_URL: string = (() => {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;

  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backend) {
    const base = backend.replace(/\/api$/, "");
    if (!base.includes("vercel.app")) return base;
  }

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
 * Returns the socket immediately if it already exists (even if it's in the
 * middle of reconnecting) so callers can attach listeners right away.
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
      // Start with polling to establish connection through ALB, then upgrade
      // to websocket. This works around ALB WebSocket upgrade issues.
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    // Wait for the first connection attempt only — don't reject on failure,
    // let the reconnection logic handle it. We return the socket so callers
    // can attach listeners immediately.
    await new Promise<void>((resolve) => {
      const onConnect = () => {
        console.log("[ChatSocket] Connected:", _socket?.id);
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        console.warn("[ChatSocket] Initial connect_error (will retry):", err.message);
        // Don't reject — Socket.IO will keep reconnecting.
        // Resolve anyway so the caller gets the socket and can attach listeners.
        cleanup();
        resolve();
      };

      const cleanup = () => {
        _socket?.off("connect", onConnect);
        _socket?.off("connect_error", onError);
      };

      // Give it 15s then resolve anyway
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
 * The socket may be in a reconnecting state — check socket.connected
 * for the actual live connection status.
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
