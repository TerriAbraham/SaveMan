import type { IconName } from '@/components/icon';
import type { Category } from '@/data/types';

export type CategoryErrors = Partial<Record<'name' | 'description', string>>;

/** Validates a category against the others. `editingId` is null when adding. */
export function validateCategory(
  draft: { name: string; description: string },
  categories: Category[],
  editingId: string | null,
): CategoryErrors {
  const errors: CategoryErrors = {};
  const name = draft.name.trim();
  if (name.length < 2) errors.name = 'Enter a category name.';
  else if (name.length > 30) errors.name = 'Keep the name under 30 characters.';
  else if (categories.some((c) => c.id !== editingId && c.name.trim().toLowerCase() === name.toLowerCase())) {
    errors.name = 'A category with this name already exists.';
  }
  if (draft.description.trim().length > 80) errors.description = 'Keep the description under 80 characters.';
  return errors;
}

const categoryIcons: Record<string, IconName> = {
  'cat-business': 'briefcase',
  'cat-finance': 'money',
  'cat-legal': 'legal',
  'cat-it': 'laptop',
  'cat-agri': 'leaf',
  'cat-hr': 'people',
  'cat-health': 'health',
  'cat-mining': 'energy',
  'cat-construction': 'construction',
  'cat-education': 'education',
  'cat-marketing': 'campaign',
  'cat-tourism': 'tourism',
  'cat-property': 'property',
  'cat-environment': 'nature',
};

/** Icon for a service category. Categories the admin adds later get a general one. */
export function categoryIcon(categoryId: string): IconName {
  return categoryIcons[categoryId] ?? 'award';
}
