const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

export function slugifyOrganizationText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(NON_ALPHANUMERIC, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function buildOrganizationSlugSegment(
  organizationId: number | string,
  name: string | null | undefined,
  country?: string | null,
): string {
  const id = String(organizationId).trim();
  const slug = slugifyOrganizationText([name, country].filter(Boolean).join(' '));

  return slug ? `${id}-${slug}` : id;
}

export function extractOrganizationIdFromRouteSegment(segment: string | null): string | null {
  const match = segment?.match(/^\d+/);
  return match?.[0] ?? null;
}
