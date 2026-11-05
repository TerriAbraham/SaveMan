import type { Category, Consultant } from '@/data/types';

export interface ConsultantFilters {
  query: string;
  categoryId: string | null; // null = all services
  city: string | null; // null = anywhere in PNG
}

/**
 * Free-text search matches name, title, service category, individual services,
 * expertise tags and location. Results are sorted best-rated first.
 */
export function filterConsultants(consultants: Consultant[], categories: Category[], filters: ConsultantFilters) {
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  return consultants
    .filter((c) => !filters.categoryId || c.categoryId === filters.categoryId)
    .filter((c) => !filters.city || c.location.city === filters.city)
    .filter((c) => {
      if (terms.length === 0) return true;
      const category = categories.find((cat) => cat.id === c.categoryId)?.name ?? '';
      const haystack = [
        c.name,
        c.title,
        category,
        ...c.expertise,
        ...c.services.map((s) => s.name),
        c.location.city,
        c.location.province,
      ]
        .join(' ')
        .toLowerCase();
      // Every word must match somewhere, so "tax lae" narrows rather than widens.
      return terms.every((t) => haystack.includes(t));
    })
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
}
