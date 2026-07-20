import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NearbyCategory {
  _id: string;
  name: string;
  icon?: string;
}

export interface WorkingDay {
  day: string;
  startTime: string;
  endTime: string;
}

export interface NearbyPartner {
  _id: string;
  fullName: string;
  profilePhoto?: string;
  bio?: string;
  skills: string[];
  categories: NearbyCategory[];
  experience?: number;
  languages: string[];
  visitingCredits?: number;
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
