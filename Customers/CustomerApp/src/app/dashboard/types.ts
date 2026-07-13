// ─── Shared TypeScript interfaces for the Dashboard ──────────────────────────

export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  /** Whether this provider is currently marked as a favourite */
  isFavourite?: boolean;
}

export interface NavItem {
  key: string;
  label: string;
  /** Ionicons icon name */
  icon: string;
  /** Ionicons icon name for the active/selected state */
  iconActive: string;
}

export interface PromoInfo {
  headline: string;
  subline: string;
  discountLabel: string;
  /** Gradient colours: [start, end] */
  gradient: [string, string];
}
