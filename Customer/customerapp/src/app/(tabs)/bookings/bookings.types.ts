// ─── Booking Types ────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ServiceAddress {
  house?: string;
  street?: string;
  locality?: string;
  city: string;
  state: string;
  pincode?: string;
  label?: string;
  coordinates?: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
}

export interface BookingReview {
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface BookingCancellation {
  cancelledBy: 'customer' | 'partner';
  reason?: string;
  cancelledAt: string;
}

export interface BookingPartner {
  _id: string;
  fullName: string;
  phone: string;
  profilePhoto?: string;
  selfieUrl?: string;
  averageRating?: number;
  visitingCredits?: { type: "perVisit" | "perHour" | "perDay" | "perWeek"; amount: number };
}

export interface BookingCategory {
  _id: string;
  name: string;
}

export interface CompletionCode {
  /** Plain 4-digit code the customer reads out to the partner */
  code: string | null;
}

export interface Booking {
  _id: string;
  status: BookingStatus;
  scheduledAt: string;
  startedAt?: string;
  completedAt?: string;
  isEmergency: boolean;
  visitingCredit?: number;
  description?: string;
  serviceAddress?: ServiceAddress;
  cancellation?: BookingCancellation;
  review?: BookingReview;
  /** Present on accepted / in_progress bookings — customer sees the plain code */
  completionCode?: CompletionCode;
  partner: BookingPartner;
  category?: BookingCategory;
  createdAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  totalPages: number;
}

export interface GetBookingsResponse {
  bookings: Booking[];
  pagination: PaginationMeta;
}

export type StatusFilter = BookingStatus | 'all';
