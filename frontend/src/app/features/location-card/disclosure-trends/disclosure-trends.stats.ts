import type { HazardEnum } from '@pac-api/client';

// Scarcity-side water hazards only; commented entries are intentionally excluded but
// kept as a reference for which related hazard types have been considered.
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

export interface TopHazard {
  rank: number;
  type: HazardEnum;
  /**
   * Share of jurisdictions reporting this hazard among the top reported,
   * formatted as a label range (e.g. "21-30%").
   */
  range: string | null;
}

/**
 * Dataset-wide disclosure trends for a given disclosure year.
 *
 * All counts and percentages are aggregated across every jurisdiction included
 * in the disclosure year — they are not scoped to a selected location.
 */
export interface DisclosureTrendsSummary {
  /** Jurisdictions that disclosed at least one adaptation goal or action. */
  adaptationPlanCount: number;
  /** Jurisdictions reporting at least one scarcity-side water hazard. */
  waterSecurityRisksCount: number;
  /** Most-reported hazards across the dataset (top 3). */
  topHazards: TopHazard[];
  /** Climate adaptation projects across all jurisdictions seeking finance. */
  projectsSeekingFinanceCount: number;
  /**
   * Share of jurisdictions facing significant climate hazards, expressed as a
   * percentage 0–100. `null` if not yet computable.
   */
  jurisdictionsExposedPct: number | null;
}
