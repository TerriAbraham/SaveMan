export type Role = 'client' | 'consultant' | 'admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type AccountStatus = 'active' | 'suspended';

export interface Location {
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

interface BaseUser {
  id: string;
  name: string;
  email: string;
  password: string; // dummy data only: never store plain passwords in a real backend
  phone: string;
  status: AccountStatus;
  createdAt: string; // ISO date
}

export interface Client extends BaseUser {
  role: 'client';
  city: string;
}

export interface Service {
  name: string;
  description: string;
  durationMins: number;
  price: number; // PGK (Kina)
}

export interface Consultant extends BaseUser {
  role: 'consultant';
  title: string;
  categoryId: string;
  bio: string;
  expertise: string[];
  services: Service[];
  hourlyRate: number; // PGK (Kina)
  yearsExperience: number;
  languages: string[];
  location: Location;
  verification: VerificationStatus;
  rating: number;
  reviewCount: number;
}

export interface Admin extends BaseUser {
  role: 'admin';
}

export type User = Client | Consultant | Admin;

export interface Category {
  id: string;
  name: string;
  description: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'declined';

export interface Booking {
  id: string;
  clientId: string;
  consultantId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMins: number;
  mode: 'in-person' | 'video' | 'phone';
  note: string;
  status: BookingStatus;
  price: number;
}

export interface Review {
  id: string;
  bookingId: string;
  clientId: string;
  consultantId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string; // ISO datetime
}

export interface Conversation {
  id: string;
  clientId: string;
  consultantId: string;
}
