import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyCategory {
  _id: string;
  name: string;
  icon?: string;
  /** Embedded subcategories on the Category document */
  subcategories?: { _id: string; name: string }[];
}

export interface NearbySubcategory {
  categoryId: string;
  subcategoryId: string;
}

export interface WorkingDay {
  day: string;
  startTime: string;
  endTime: string;
}

export type PricingType = "perVisit" | "perHour" | "perDay" | "perWeek";

export interface VisitingCredits {
  type: PricingType;
  amount: number;
}

export interface NearbyPartner {
  _id: string;
  fullName: string;
  profilePhoto?: string;
  selfieUrl?: string;
  bio?: string;
  categories: NearbyCategory[];
  /** Which subcategories the partner has selected, keyed by categoryId */
  subcategories?: NearbySubcategory[];
  experience?: number;
  languages: string[];
  visitingCredits?: VisitingCredits;
  /** Flat fee deducted per chat session (₹) */
  chatCharges?: number;
  /** Fee + duration block deducted per call */
  callCharges?: { amount: number; durationMinutes: number };
  emergencyAvailable: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  workingDays: WorkingDay[];
  serviceRadius: number;
  /** GeoJSON Point — [longitude, latitude] */
  serviceLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
  distanceKm: number;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
}

export interface NearbyServicesResponse {
  count: number;
  coordinates: { longitude: number; latitude: number };
  services: NearbyPartner[];
}

export interface NearbyServicesParams {
  lat?: number;
  lng?: number;
  categoryId?: string;
  maxRadius?: number;
}

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * GET /api/customer/services/nearby
 *
 * Pass lat/lng for live GPS. If omitted, the backend falls back to
 * the customer's saved currentLocation.
 */
export const fetchNearbyServices = (params: NearbyServicesParams = {}) =>
  api.get<NearbyServicesResponse>("/customer/services/nearby", { params });
