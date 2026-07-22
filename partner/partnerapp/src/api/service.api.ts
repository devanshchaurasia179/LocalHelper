/**
 * service.api.ts
 *
 * HTTP calls for partner service/availability operations.
 */

import { api } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceDetails {
  _id: string;
  categories: { _id: string; name: string }[];
  skills: string[];
  experience?: number;
  languages?: string[];
  bio?: string;
  visitingCredits?: number;
  emergencyAvailable: boolean;
  serviceRadius: number;
  isOnline: boolean;
  isAvailable: boolean;
  workingDays?: { day: string; startTime: string; endTime: string }[];
}

export interface AvailabilityResponse {
  message: string;
  isOnline: boolean;
  isAvailable: boolean;
}

// ─── GET /api/partner/service ─────────────────────────────────────────────────

export async function fetchServiceDetails(): Promise<ServiceDetails> {
  const res = await api.get<{ service: ServiceDetails }>("/partner/service");
  return res.data.service;
}

// ─── PATCH /api/partner/service/availability ──────────────────────────────────

export async function updateAvailability(params: {
  isOnline?: boolean;
  isAvailable?: boolean;
}): Promise<AvailabilityResponse> {
  const res = await api.patch<AvailabilityResponse>(
    "/partner/service/availability",
    params
  );
  return res.data;
}

// ─── GET /api/partner/service/dashboard ───────────────────────────────────────

export interface DashboardStats {
  todayBookings: number;
  totalEarnings: number;
  walletBalance: number;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await api.get<DashboardStats>("/partner/service/dashboard");
  return res.data;
}
