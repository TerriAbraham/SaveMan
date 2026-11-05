import type { Service } from '@/data/types';

export const DURATION_OPTIONS = [30, 60, 90, 120, 180];

export interface ServiceDraft {
  name: string;
  description: string;
  durationMins: number;
  price: string; // as typed
}

export type ServiceErrors = Partial<Record<'name' | 'description' | 'price', string>>;

/** Validates a draft against the consultant's other services. `editingId` is null when adding. */
export function validateService(draft: ServiceDraft, services: Service[], editingId: string | null): ServiceErrors {
  const errors: ServiceErrors = {};
  const name = draft.name.trim();
  const price = Number(draft.price);

  if (name.length < 3) errors.name = 'Enter a service name (at least 3 characters).';
  else if (name.length > 60) errors.name = 'Keep the name under 60 characters.';
  else if (services.some((s) => s.id !== editingId && s.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = 'You already have a service with this name.';
  }
  if (draft.description.trim().length > 200) errors.description = 'Keep the description under 200 characters.';
  if (draft.price.trim() === '' || !Number.isInteger(price) || price <= 0) {
    errors.price = 'Enter a whole number of Kina, e.g. 250.';
  } else if (price > 100000) errors.price = 'That price looks too high.';

  return errors;
}

/** Applies a valid draft: replaces the service being edited, or appends a new one. */
export function upsertService(services: Service[], draft: ServiceDraft, editingId: string | null, newId: string): Service[] {
  const service: Service = {
    id: editingId ?? newId,
    name: draft.name.trim(),
    description: draft.description.trim(),
    durationMins: draft.durationMins,
    price: Number(draft.price),
  };
  return editingId ? services.map((s) => (s.id === editingId ? service : s)) : [...services, service];
}
