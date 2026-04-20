import type { Hazard } from '@pac-api/client';

export type LocationCardTabKey = 'hazards' | 'actions' | 'solutions';

export const DEFAULT_LOCATION_CARD_TAB: LocationCardTabKey = 'hazards';

export function buildHazardActionFilter(hazard: Hazard): string {
  return `${hazard.hazardType}|${hazard.otherHazardDetails || ''}`;
}

export function shouldClearHazardFilter(tab: LocationCardTabKey): boolean {
  return tab !== 'actions';
}
