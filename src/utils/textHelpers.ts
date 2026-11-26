/**
 * Returns 1-2 uppercase initials from a person or business name.
 * Reusable across Dashboard, Profile, and Clients cards.
 */
export function getInitials(name: string | null | undefined, fallback = 'Q'): string {
  if (!name?.trim()) return fallback;
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p.charAt(0).toUpperCase()).join('') || fallback;
}
