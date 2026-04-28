import type { HazardEnum, LocationProfile } from '@pac-api/client';

// Scarcity-side water hazards only; commented entries are intentionally excluded but
// kept as a reference for which related hazard types have been considered.
const WATER_HAZARD_TYPES: HazardEnum[] = [
  'WATER_STRESS',
  'DROUGHT',
  'INCREASED_WATER_DEMAND',
  // 'URBAN_FLOODING',
  // 'RIVER_FLOODING',
  // 'COASTAL_FLOODING',
  // 'OTHER_COASTAL_EVENTS',
  // 'OCEANIC_EVENTS',
  // 'STORM',
  // 'HEAVY_PRECIPITATION',
];

export function adaptationPlanCount(profile: LocationProfile): number {
  const actions = profile.governmentActions?.actions ?? [];
  const goals = profile.governmentActions?.goals ?? [];
  return actions.length + goals.length;
}

export function waterSecurityRisksCount(profile: LocationProfile): number {
  return (profile.hazards?.hazards ?? []).filter((h) =>
    WATER_HAZARD_TYPES.includes(h.hazard.hazardType),
  ).length;
}

export interface TopHazard {
  rank: number;
  type: HazardEnum;
  range: string | null;
}

export function topHazards(profile: LocationProfile): TopHazard[] {
  return (profile.hazards?.hazards ?? [])
    .slice()
    .sort((a, b) => a.hazardRank - b.hazardRank)
    .map((h) => ({
      rank: h.hazardRank,
      type: h.hazard.hazardType,
      range: h.proportionExposedRange ?? null,
    }));
}

export interface ProjectsFinanceSummary {
  count: number;
  totalNeededUsd: number | null;
}

export function projectsSeekingFinance(profile: LocationProfile): ProjectsFinanceSummary {
  const projects = profile.governmentActions?.projects ?? [];
  const hasAnyTotal = projects.some((p) => p.totalNeeded != null);
  const total = projects.reduce((sum, p) => sum + (p.totalNeeded ?? 0), 0);
  return {
    count: projects.length,
    totalNeededUsd: hasAnyTotal ? total : null,
  };
}

export function populationExposedPct(profile: LocationProfile): number | null {
  return profile.hazards?.statistics?.populationExposedPercentage ?? null;
}
