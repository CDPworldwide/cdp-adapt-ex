import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError, of } from 'rxjs';
import {
  getLocationApiV1LocationsLocationNameGet,
  getLocationByOrgIdApiV1LocationsIdOrganizationIdGet,
  getAllLocationNamesApiV1LocationsNamesGet,
  type LocationNamesResponse,
} from '@pac-api/client';
import type { LocationProfile, LocationResponse } from '@pac-api/client';
import { LocationSuggestion } from './location-suggestion';
import { createApiClient } from './api-client';
import { LanguageService } from './language.service';
import { normalizeTranslationLanguage } from './translation-language.util';
import {
  buildOrganizationSlugSegment,
  extractOrganizationIdFromRouteSegment,
} from '../utils/org-slug.util';
import { inferLocationCountry } from '../utils/location-country.util';

type LocationNameSummary = LocationNamesResponse['locations'][number] & {
  disclosure_status?: string | null;
  is_reporting_leader?: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private client = createApiClient();
  private languageService = inject(LanguageService);

  getLocation(locationName: string): Observable<LocationProfile> {
    return from(
      getLocationApiV1LocationsLocationNameGet({
        client: this.client,
        path: { location_name: locationName },
        query: this.locationTranslationQuery(),
      } as unknown as Parameters<typeof getLocationApiV1LocationsLocationNameGet>[0]),
    ).pipe(
      map((response) => {
        const result = response as { data?: LocationResponse; error?: unknown };
        if (result.error) {
          throw result;
        }
        return result.data!.location as LocationProfile;
      }),
    );
  }

  getLocationByOrganizationId(organizationId: string): Observable<LocationProfile> {
    const normalizedOrganizationId = extractOrganizationIdFromRouteSegment(organizationId);
    if (!normalizedOrganizationId) {
      throw new Error(`Invalid organization ID: ${organizationId}`);
    }

    return from(
      getLocationByOrgIdApiV1LocationsIdOrganizationIdGet({
        client: this.client,
        path: { organization_id: Number(normalizedOrganizationId) },
        query: this.locationTranslationQuery(),
      } as unknown as Parameters<typeof getLocationByOrgIdApiV1LocationsIdOrganizationIdGet>[0]),
    ).pipe(
      map((response) => {
        const result = response as { data?: LocationResponse; error?: unknown };
        if (result.error) {
          throw result;
        }
        return result.data!.location as LocationProfile;
      }),
    );
  }

  getAllLocationNames(): Observable<LocationSuggestion[]> {
    return from(
      getAllLocationNamesApiV1LocationsNamesGet({
        client: this.client,
      }),
    ).pipe(
      map((response) => {
        if (response.error) {
          throw response.error;
        }

        return (response.data as LocationNamesResponse).locations.flatMap((location) => {
          const locationSummary = location as LocationNameSummary;

          if (!location.name) {
            return [];
          }

          const country = inferLocationCountry(location.name, location.country);

          return [
            {
              organizationId: location.id,
              slug: buildOrganizationSlugSegment(location.id, location.name, country),
              name: location.name,
              country,
              // `disclosure_status` is "Submitted" if the jurisdiction returned
              // a questionnaire this cycle, or "Amended" if they updated a
              // prior submission. Both count as disclosers. Anything else
              // (including "non-disclosed" or NULL) is treated as a non-discloser.
              disclosesToCDP: ['Submitted', 'Amended'].includes(
                locationSummary.disclosure_status ?? '',
              ),
              isReportingLeader: locationSummary.is_reporting_leader ?? false,
            },
          ];
        });
      }),
      catchError((error) => {
        console.error('Error fetching location names:', error);
        return of([]);
      }),
    );
  }

  private locationTranslationQuery(): { target_language: string } {
    return {
      target_language: normalizeTranslationLanguage(this.languageService.currentLang()),
    };
  }
}
