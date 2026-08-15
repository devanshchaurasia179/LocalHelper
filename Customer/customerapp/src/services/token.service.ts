/**
 * TokenService
 *
 * The backend authenticates via httpOnly cookies (`customer_token`) which are
 * set/cleared entirely server-side. This service is a thin abstraction that
 * exposes helpers for signalling auth state that lives alongside the cookie.
 *
 * On React Native the cookie is sent automatically by axios `withCredentials`
 * when you hit the same origin. For native we rely on react-native's built-in
 * cookie jar (enabled by withCredentials + the backend's CORS config).
 *
 * If you ever need to migrate to Bearer tokens, swap the internals here.
 */
export const TokenService = {
  /**
   * Nothing to store on the client – the httpOnly cookie is managed by the
   * browser / native network layer. Expose a no-op so call-sites are future-proof.
   */
  store(_token: string): void {
    // httpOnly cookie – handled by the network layer
  },

  /**
   * Returns true when the user appears logged in based on cached customer data.
   * This is a quick synchronous check; the canonical source of truth is the
   * /me endpoint hit on boot.
   */
  hasSession(): boolean {
    // Cookie-based auth has no client-visible token.
    // The AuthProvider handles the real check via /me.
    return false;
  },

  /** Clear any client-side hints of a session (cookie is cleared server-side). */
  clear(): void {
    // no-op for cookie-based auth
  },
};
