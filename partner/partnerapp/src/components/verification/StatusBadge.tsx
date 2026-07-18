/**
 * StatusBadge.tsx
 *
 * Renders a status chip from the backend's badge object: { label, color }.
 *
 * The backend pre-computes both label and color — this component just
 * maps the color string to actual design-system tokens and renders.
 *
 * Frontend rule: never check badge.label === "Approved" or similar.
 * Just render what the backend sends.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { BadgeColor } from "@/types/verification";
import { fonts, radii, spacing } from "@/constants/theme";

type Props = {
  label: string;
  color: BadgeColor;
};

// Maps backend color string → visual tokens
const BADGE_TOKENS: Record<
  BadgeColor,
  { bg: string; border: string; text: string; dot: string }
> = {
  gray: {
    bg:     "#F3F4F6",
    border: "#E5E7EB",
    text:   "#6B7280",
    dot:    "#9CA3AF",
  },
  yellow: {
    bg:     "#FFFBEB",
    border: "#FDE68A",
    text:   "#92400E",
    dot:    "#F59E0B",
  },
  green: {
    bg:     "#ECFDF5",
    border: "#A7F3D0",
    text:   "#065F46",
    dot:    "#10B981",
  },
  red: {
    bg:     "#FEF2F2",
    border: "#FECACA",
    text:   "#991B1B",
    dot:    "#EF4444",
  },
};

export function StatusBadge({ label, color }: Props) {
  const tokens = BADGE_TOKENS[color] ?? BADGE_TOKENS.gray;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: tokens.bg, borderColor: tokens.border },
      ]}
      accessibilityLabel={`Status: ${label}`}
    >
      <View style={[styles.dot, { backgroundColor: tokens.dot }]} />
      <Text style={[styles.label, { color: tokens.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fonts.jakartaSemiBold,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
