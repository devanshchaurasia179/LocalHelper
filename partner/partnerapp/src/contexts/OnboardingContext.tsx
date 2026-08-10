/**
 * OnboardingContext.tsx
 *
 * Shared in-memory store for the 3-step onboarding funnel.
 * Lives inside the (onboarding) layout so it's created once and
 * survives step-to-step navigation without losing form state.
 *
 * Each screen reads its slice, writes its slice, and the data
 * persists as the partner navigates forward and backward.
 */

import React, { createContext, useContext, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkingDay = { day: string };

export type ProfileDraft = {
  fullName: string;
  gender: string | null;
  dateOfBirth: Date | null;
  house: string;
  street: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  locationCoords: { latitude: number; longitude: number } | null;
  locationAddress: string | null;
  serviceRadius: number;
};

export type SelectedSubcategory = {
  categoryId: string;
  subcategoryId: string;
};

export type ServiceDraft = {
  selectedCats: string[];
  selectedSubcats: SelectedSubcategory[];
  experience: string;
  selectedLangs: string[];
  bio: string;
  visitingCreditsType: "perVisit" | "perHour" | "perDay" | "perWeek";
  visitingCreditsAmount: string;
  workingDays: WorkingDay[];
};

type OnboardingContextType = {
  profile: ProfileDraft;
  setProfile: (patch: Partial<ProfileDraft>) => void;

  service: ServiceDraft;
  setService: (patch: Partial<ServiceDraft>) => void;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: ProfileDraft = {
  fullName: "",
  gender: null,
  dateOfBirth: null,
  house: "",
  street: "",
  locality: "",
  city: "",
  state: "",
  pincode: "",
  locationCoords: null,
  locationAddress: null,
  serviceRadius: 10,
};

const DEFAULT_SERVICE: ServiceDraft = {
  selectedCats: [],
  selectedSubcats: [],
  experience: "",
  selectedLangs: ["Hindi", "English"],
  bio: "",
  visitingCreditsType: "perVisit",
  visitingCreditsAmount: "",
  workingDays: [],
};

// ─── Context ──────────────────────────────────────────────────────────────────

const OnboardingContext = createContext<OnboardingContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<ProfileDraft>(DEFAULT_PROFILE);
  const [service, setServiceState] = useState<ServiceDraft>(DEFAULT_SERVICE);

  const setProfile = (patch: Partial<ProfileDraft>) =>
    setProfileState((prev) => ({ ...prev, ...patch }));

  const setService = (patch: Partial<ServiceDraft>) =>
    setServiceState((prev) => ({ ...prev, ...patch }));

  return (
    <OnboardingContext.Provider value={{ profile, setProfile, service, setService }}>
      {children}
    </OnboardingContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used inside <OnboardingProvider>");
  return ctx;
}
