export function buildOrganizationSlugSegment(
  organizationId: number,
  organizationName: string,
  countryName?: string | null,
): string {
  const locationParts = [organizationName, countryName].filter(
    (part): part is string => Boolean(part?.trim()),
  );
  const slug = locationParts.map(slugifyOrganizationPart).filter(Boolean).join('-');

  return slug ? `${organizationId}-${slug}` : String(organizationId);
}

function slugifyOrganizationPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
