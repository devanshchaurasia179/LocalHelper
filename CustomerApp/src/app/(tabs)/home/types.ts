export interface Provider {
  id: string;
  name: string;
  category: string;   // first category name, or 'General'
  pricePerHour: number;
  rating: number;
  image: string;      // require() result or remote URL
  distanceKm?: number;
}

export interface PromoOffer {
  discountPercent: number;
  description: string;
  serviceName: string;
  servicePrice: number;
  image: string;
}

export type NavRoute = 'home' | 'chat' | 'bookings' | 'profile';
