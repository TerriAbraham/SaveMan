export type Role = 'client' | 'consultant' | 'admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type AccountStatus = 'active' | 'suspended';

/** A PNG town or city centre, used for filters and as a starting point when choosing a location. */
export interface Place {
  city: string;
  province: string;
  latitude: number;
  longitude: number;
}

/** Where a consultant meets clients: nearest centre plus their exact office pin. */
export interface Location extends Place {
  address: string; // street / suburb, shown to clients
}

interface BaseUser {
  id: string;
  name: string;
  email: string;
  password: string; // dummy data only: never store plain passwords in a real backend
  phone: string;
  /** Profile photo picked on the phone (a local image URI). Initials are shown without one. */
  avatarUri?: string;
  status: AccountStatus;
  createdAt: string; // ISO date
}

export interface Client extends BaseUser {
  role: 'client';
  city: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  durationMins: number;
  price: number; // PGK (Kina)
}

/** A degree, certificate or professional licence, shown to clients and checked by the admin before verifying. */
export interface Qualification {
  id: string;
  name: string; // e.g. "Certified Practising Accountant"
  issuer: string; // e.g. "CPA PNG"
  year: number;
  licenceNumber?: string; // registration or licence number, if there is one
}

/** A block of working time, "HH:mm" in local time. */
export interface TimeWindow {
  start: string;
  end: string;
}

/** Working windows per weekday, 0 = Sunday ... 6 = Saturday. Missing days are days off. */
export type WeeklyAvailability = Partial<Record<0 | 1 | 2 | 3 | 4 | 5 | 6, TimeWindow[]>>;

export interface Consultant extends BaseUser {
  role: 'consultant';
  title: string;
  categoryId: string;
  bio: string;
  expertise: string[];
  qualifications: Qualification[];
  services: Service[];
  availability: WeeklyAvailability;
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
  serviceName: string;
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
  /** Set when an admin removes the review. Kept (not deleted) so it can be restored and can't be re-posted. */
  removedAt?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  sentAt: string; // local "YYYY-MM-DDTHH:mm:ss"
  read: boolean; // has the recipient opened it
}

export interface Conversation {
  id: string;
  clientId: string;
  consultantId: string;
}
