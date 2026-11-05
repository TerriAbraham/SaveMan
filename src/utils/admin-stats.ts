import type { Booking, BookingStatus, Review, User } from '@/data/types';

export interface AdminStats {
  users: number; // clients + consultants (admins excluded)
  clients: number;
  consultants: number;
  verifiedConsultants: number;
  pendingVerification: number;
  suspended: number;
  bookings: number;
  bookingsByStatus: Record<BookingStatus, number>;
  completedValue: number; // Kina, completed bookings only
  reviews: number; // visible
  removedReviews: number;
}

export function computeStats(users: User[], bookings: Booking[], reviews: Review[]): AdminStats {
  const clients = users.filter((u) => u.role === 'client');
  const consultants = users.filter((u) => u.role === 'consultant');
  const bookingsByStatus: Record<BookingStatus, number> = { pending: 0, confirmed: 0, completed: 0, cancelled: 0, declined: 0 };
  for (const b of bookings) bookingsByStatus[b.status] += 1;

  return {
    users: clients.length + consultants.length,
    clients: clients.length,
    consultants: consultants.length,
    verifiedConsultants: consultants.filter((c) => c.verification === 'verified').length,
    pendingVerification: consultants.filter((c) => c.verification === 'pending').length,
    suspended: [...clients, ...consultants].filter((u) => u.status === 'suspended').length,
    bookings: bookings.length,
    bookingsByStatus,
    completedValue: bookings.filter((b) => b.status === 'completed').reduce((sum, b) => sum + b.price, 0),
    reviews: reviews.filter((r) => !r.removedAt).length,
    removedReviews: reviews.filter((r) => r.removedAt).length,
  };
}
