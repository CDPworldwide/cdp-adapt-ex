import type { HazardEnum } from '@pac-api/client';

// Re-export the generated types so existing imports stay stable. The backend
// schema in backend/app/schemas/disclosure_trends.py is the single source of
// truth.
export type { DisclosureTrendsSummary, TopHazard } from '@pac-api/client';

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
