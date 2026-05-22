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
    return from(
      getLocationByOrgIdApiV1LocationsIdOrganizationIdGet({
        client: this.client,
        path: { organization_id: Number(organizationId) },
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
          if (!location.name) {
            return [];
          }

          return [
            {
              organizationId: location.id,
              name: location.name,
              country: location.country?.trim() || undefined,
              // Non-disclosers have a null/empty public_status. Public and
              // Non-Public disclosers both surface as "discloses" since the
              // jurisdiction did appear in CDP's report.
              disclosesToCDP: !!location.public_status,
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
