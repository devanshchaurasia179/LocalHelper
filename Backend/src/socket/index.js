import { Server } from "socket.io";
import { registerChatHandlers } from "./chat.socket.js";

let _io = null;

/**
 * initSocket(httpServer)
 *
 * Creates the Socket.IO server, configures CORS to match the Express setup,
 * registers all namespaced handlers, and stores the instance for later
 * access via getIO().
 *
 * Call this once in server.js after creating the http.Server.
 */
export const initSocket = (httpServer) => {
  _io = new Server(httpServer, {
    cors: {
      origin: true,         // mirrors the Express cors({ origin: true }) setting
      credentials: true,
    },
    // Allow both transports — polling for initial handshake (works through ALB),
    // then auto-upgrade to websocket for better performance.
    transports: ["polling", "websocket"],
    // Enable sticky sessions via cookie to ensure polling requests hit same instance
    cookie: {
      name: "io",
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    },
  });

  // ── /chat namespace ───────────────────────────────────────────────────────
  // All chat traffic lives under its own namespace to keep it isolated from
  // any future namespaces (e.g. /notifications).
  const chatNS = _io.of("/chat");
  registerChatHandlers(chatNS);

  console.log("[Socket.IO] Initialised — /chat namespace ready");
  return _io;
};

/**
 * getIO()
 *
 * Returns the Socket.IO server instance so controllers and other modules
 * can emit events without needing the instance passed around as a parameter.
 *
 * Throws if called before initSocket() — this is intentional to catch
 * misconfiguration early.
 */
export const getIO = () => {
  if (!_io) {
    throw new Error("Socket.IO has not been initialised. Call initSocket() first.");
  }
  return _io;
};
