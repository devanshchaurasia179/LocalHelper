/**
 * DocumentIcon.tsx
 *
 * Maps the backend's icon string to an Ionicons icon name.
 *
 * The backend stores a human-readable icon slug (e.g. "camera", "shield").
 * This component is the ONLY place that maps slugs to actual icon names.
 *
 * If the backend adds a new icon slug that isn't mapped here, we fall back
 * to "document-outline" — so the UI never breaks on unknown slugs.
 *
 * To add a new icon: add one entry to ICON_MAP. That's it.
 */

import React from "react";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  /** Icon slug from the backend, e.g. "camera", "id-card", "shield" */
  name: string | null;
  size?: number;
  color?: string;
};

const ICON_MAP: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  // Identity documents
  "id-card":       "id-card-outline",
  "credit-card":   "card-outline",
  "document":      "document-outline",
  "document-text": "document-text-outline",

  // Face / selfie
  "camera":        "camera-outline",
  "person":        "person-circle-outline",
  "selfie":        "camera-reverse-outline",

  // Authority / government
  "shield":        "shield-checkmark-outline",
  "badge":         "shield-outline",
  "government":    "business-outline",

  // Business documents
  "briefcase":     "briefcase-outline",
  "store":         "storefront-outline",
  "receipt":       "receipt-outline",
  "gst":           "receipt-outline",

  // Generic
  "file":          "attach-outline",
  "image":         "image-outline",
  "star":          "star-outline",
};

export function DocumentIcon({ name, size = 24, color = "#626262" }: Props) {
  const iconName = name ? (ICON_MAP[name] ?? "document-outline") : "document-outline";

  return <Ionicons name={iconName} size={size} color={color} />;
}
