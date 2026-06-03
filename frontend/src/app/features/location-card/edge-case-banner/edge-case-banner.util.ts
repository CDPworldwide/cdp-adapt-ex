import type { HazardProfile } from '@pac-api/client';

export type EdgeCaseBannerVariant = 'no-report' | 'non-public' | 'no-hazards' | null;

// Shared by the Hazards and Government Actions tabs so the banner copy matches.
export function getEdgeCaseBannerVariant(
  publicStatus: string | null | undefined,
  hazards: HazardProfile[] | undefined,
): EdgeCaseBannerVariant {
  // GEE-Derived rows are CDP analysis, not the jurisdiction's own disclosure.
  const disclosedCount = (hazards ?? []).filter((h) => h.source !== 'GEE-Derived').length;
  if (disclosedCount > 0) return null;
  if (publicStatus == null || publicStatus === 'GEE-Derived') return 'no-report';
  if (publicStatus === 'Non-Public') return 'non-public';
  if (publicStatus === 'Public') return 'no-hazards';
  return null;
}
