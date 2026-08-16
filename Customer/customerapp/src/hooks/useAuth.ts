/**
 * useAuth
 *
 * Convenience re-export so imports throughout the app are consistent:
 *   import { useAuth } from '@/hooks/useAuth';
 *
 * The implementation lives in AuthProvider to keep context + hook together.
 */
export { useAuth } from "@/providers/AuthProvider";
