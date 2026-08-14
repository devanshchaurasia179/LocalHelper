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
 * 2. EXPO_PUBLIC_DIRECT_UPLOAD_URL stripped of "/api" suffix
 * 3. http://<dev-host>:5001  (local dev fallback)
 */
export const SOCKET_BASE_URL: string = (() => {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL;
  if (explicit) return explicit;

  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backend) {
    // Strip /api suffix if present
    const base = backend.replace(/\/api$/, "");
    // If it's the vercel proxy, we can't use it for websocket
    if (base.includes("vercel.app")) {
      // Fall back to dev host
      return `http://${devHost}:5001`;
    }
    return base;
  }

  return `http://${devHost}:5001`;
})();

console.log("[ChatSocket] Base URL:", SOCKET_BASE_URL);

// ─── Singleton state ──────────────────────────────────────────────────────────

let _socket: Socket | null = null;
let _connecting = false;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Connect (or return the existing connected socket).
 * Fetches a fresh socket-token from the server on every new connection.
 */
export async function connectChatSocket(): Promise<Socket> {
  if (_socket?.connected) return _socket;

  // Prevent race conditions with multiple callers
  if (_connecting) {
    return new Promise((resolve, reject) => {
      const check = setInterval(() => {
        if (_socket?.connected) {
          clearInterval(check);
          resolve(_socket!);
        } else if (!_connecting) {
          clearInterval(check);
          reject(new Error("Socket connection failed"));
        }
      }, 100);
    });
  }

  _connecting = true;

  // Disconnect any stale socket before creating a new one
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }

  try {
    const { data } = await getSocketToken();
    const { token } = data;

    _socket = io(`${SOCKET_BASE_URL}/chat`, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
      timeout: 10000,
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Socket connection timed out"));
      }, 12000);

      _socket!.once("connect", () => {
        clearTimeout(timeout);
        console.log("[ChatSocket] Connected:", _socket?.id);
        resolve();
      });

      _socket!.once("connect_error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
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
 * Get the current socket, or null if not connected.
 */
export function getChatSocket(): Socket | null {
  return _socket?.connected ? _socket : null;
}
