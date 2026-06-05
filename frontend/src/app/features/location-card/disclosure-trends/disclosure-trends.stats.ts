import type {
  DisclosureTrendsSummary as ApiDisclosureTrendsSummary,
  HazardEnum,
} from '@pac-api/client';

export type { TopHazard } from '@pac-api/client';

export type DisclosureTrendsSummary = ApiDisclosureTrendsSummary & {
  jurisdictionCount: number;
  countryCount: number;
  adaptationActionsCount: number;
  climateProjectsCount: number;
  projectFocusBreakdown: string;
  waterSecurityRisksPct: number;
  floodingRisksPct: number;
};

export const STATIC_DISCLOSURE_TRENDS_2025: DisclosureTrendsSummary = {
  jurisdictionCount: 1005,
  countryCount: 80,
  adaptationActionsCount: 6355,
  climateProjectsCount: 2871,
  projectFocusBreakdown:
    '52% mitigation-focused, 30% adaptation-focused, 12% dual-focused, 6% unknown',
  waterSecurityRisksPct: 54,
  floodingRisksPct: 73,
  jurisdictionsExposedPct: 66,
  adaptationPlanCount: 1005,
  waterSecurityRisksCount: 54,
  projectsSeekingFinanceCount: 2871,
  topHazards: [
    { rank: 1, type: 'EXTREME_HEAT', range: '58%' },
    { rank: 2, type: 'URBAN_FLOODING', range: '49%' },
    { rank: 3, type: 'DROUGHT', range: '45%' },
  ],
};

// Scarcity-side water hazards only; commented entries are intentionally excluded but
// kept as a reference for which related hazard types have been considered.
// The authoritative list lives in the backend repo at
// backend/app/services/clients/database/disclosure_trends_repository.py
// (WATER_HAZARD_DB_STRINGS); this list is preserved here for product reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
