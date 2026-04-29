import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import type { DisclosureTrendsSummary } from './disclosure-trends.stats';

/**
 * Provides dataset-wide disclosure trends for the homepage.
 *
 * TODO: replace the placeholder summary with a real aggregate endpoint once
 * the backend exposes one (e.g. `/api/v1/disclosure-trends?year=YYYY`). The
 * shape of {@link DisclosureTrendsSummary} matches what the component renders;
 * the wiring here is the only thing that needs to change.
 */
@Injectable({ providedIn: 'root' })
export class DisclosureTrendsStatsService {
  getSummary(_year: number): Observable<DisclosureTrendsSummary> {
    return of({
      adaptationPlanCount: 312,
      waterSecurityRisksCount: 184,
      topHazards: [
        { rank: 1, type: 'EXTREME_HEAT', range: '41-50%' },
        { rank: 2, type: 'URBAN_FLOODING', range: '31-40%' },
        { rank: 3, type: 'DROUGHT', range: '21-30%' },
      ],
      projectsSeekingFinanceCount: 427,
      jurisdictionsExposedPct: 68,
    });
  }
}
