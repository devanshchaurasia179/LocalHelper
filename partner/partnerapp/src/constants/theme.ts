/**
 * Design tokens for the Partner app.
 * Mirrors the customer app's palette — same brand, same feel.
 */

import "@/global.css";

import { Platform } from "react-native";

// ─── Palette ──────────────────────────────────────────────────────────────────

export const colors = {
  primary: "#16493c",
  primaryDark: "#0d2e26",
  background: "#FFFFFF",
  surface: "#F7F7FB",
  surfaceAlt: "#F5F5F5",
  textPrimary: "#1C1C28",
  textSecondary: "#626262ff",
  white: "#FFFFFF",
  star: "#FFB800",
  navInactive: "#B7B7C9",
  chipBackground: "rgba(255,255,255,0.18)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

// ─── Font families ────────────────────────────────────────────────────────────

export const fonts = {
  jostLight: "Jost_300Light",
  jostRegular: "Jost_400Regular",
  jostMedium: "Jost_500Medium",
  jostSemiBold: "Jost_600SemiBold",
  oswaldRegular: "Oswald_400Regular",
  oswaldSemiBold: "Oswald_600SemiBold",
  oswaldBold: "Oswald_700Bold",
  archivoBlack: "ArchivoBlack_400Regular",
  jakartaRegular: "PlusJakartaSans_400Regular",
  jakartaMedium: "PlusJakartaSans_500Medium",
  jakartaSemiBold: "PlusJakartaSans_600SemiBold",
  jakartaBold: "PlusJakartaSans_700Bold",
};

// ─── Legacy theme tokens (used by default Expo template components) ───────────

export const Colors = {
  light: {
    text: "#000000",
    background: "#ffffff",
    backgroundElement: "#F0F0F3",
    backgroundSelected: "#E0E1E6",
    textSecondary: "#60646C",
  },
  dark: {
    text: "#ffffff",
    background: "#000000",
    backgroundElement: "#212225",
    backgroundSelected: "#2E3135",
    textSecondary: "#B0B4BA",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", serif: "ui-serif", rounded: "ui-rounded", mono: "ui-monospace" },
  default: { sans: "normal", serif: "serif", rounded: "normal", mono: "monospace" },
  web: { sans: "var(--font-display)", serif: "var(--font-serif)", rounded: "var(--font-rounded)", mono: "var(--font-mono)" },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
