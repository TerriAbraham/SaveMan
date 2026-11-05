import { useAuth } from '@/context/auth-context';
import { useData } from '@/context/data-context';
import type { Consultant } from '@/data/types';

/** Consultants clients can see: verified by the admin and not suspended. */
export function usePublicConsultants() {
  const { users } = useAuth();
  return users.filter(
    (u): u is Consultant => u.role === 'consultant' && u.verification === 'verified' && u.status === 'active',
  );
}

export function usePublicConsultant(id: string | undefined) {
  return usePublicConsultants().find((c) => c.id === id) ?? null;
}

/** Reviews for a consultant, newest first, with the reviewer's name attached. */
export function useConsultantReviews(consultantId: string) {
  const { users } = useAuth();
  const { reviews } = useData();
  return reviews
    .filter((r) => r.consultantId === consultantId && !r.removedAt)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r, reviewerName: users.find((u) => u.id === r.clientId)?.name ?? 'SaveMan client' }));
}
