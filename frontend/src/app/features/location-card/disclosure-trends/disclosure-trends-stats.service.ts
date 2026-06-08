import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  STATIC_DISCLOSURE_TRENDS_2025,
  type DisclosureTrendsSummary,
} from './disclosure-trends.stats';

/**
 * Provides dataset-wide disclosure trends for the homepage.
 */
@Injectable({ providedIn: 'root' })
export class DisclosureTrendsStatsService {
  getSummary(year: number): Observable<DisclosureTrendsSummary> {
    if (year !== 2025) {
      throw new Error(`Static disclosure trends are only available for 2025, received ${year}.`);
    }
    return of(STATIC_DISCLOSURE_TRENDS_2025);
  }
}
