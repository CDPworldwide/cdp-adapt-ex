import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  type DisclosureTrendsSummary,
  getDisclosureTrendsApiV1DisclosureTrendsGet,
} from '@pac-api/client';
import { createClient, createConfig } from '@pac-api/client/client';
import { environment } from '@env/environment';

/**
 * Provides dataset-wide disclosure trends for the homepage.
 */
@Injectable({ providedIn: 'root' })
export class DisclosureTrendsStatsService {
  private client = createClient(
    createConfig({
      baseUrl: environment.baseUrl,
    }),
  );

  getSummary(year: number): Observable<DisclosureTrendsSummary> {
    return from(
      getDisclosureTrendsApiV1DisclosureTrendsGet({
        client: this.client,
        query: { year },
      }).then((res) => {
        if (res.error) {
          throw res.error;
        }
        return res.data as DisclosureTrendsSummary;
      }),
    );
  }
}
