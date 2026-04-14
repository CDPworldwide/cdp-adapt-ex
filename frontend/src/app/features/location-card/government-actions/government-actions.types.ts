import { HazardEnum } from '@pac-api/client';
import type { Hazard } from '@pac-api/client';

export interface HazardSummaryRow {
  hazard: Hazard;
  goalsCount: number;
  actionsCount: number;
  icon: HazardEnum;
}

export type DetailItemType = 'goal' | 'action' | 'project';
