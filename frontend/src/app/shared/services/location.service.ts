import { Injectable } from '@angular/core';
import { Observable, from, map, catchError, of, throwError } from 'rxjs';
import {
  getLocationApiV1LocationsLocationNameGet,
  getLocationByOrgIdApiV1LocationsIdOrganizationIdGet,
  getAllLocationNamesApiV1LocationsNamesGet,
  type LocationNamesResponse,
} from '@pac-api/client';
import type { LocationProfile, LocationResponse } from '@pac-api/client';
import { LocationSuggestion } from './location-suggestion';
import { createApiClient } from './api-client';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private client = createApiClient();

  getLocation(locationName: string): Observable<LocationProfile> {
    return from(
      getLocationApiV1LocationsLocationNameGet({
        client: this.client,
        path: { location_name: locationName },
      }),
    ).pipe(
      map((response) => {
        if (response.error) {
          throw response;
        }
        return (response.data as LocationResponse).location as LocationProfile;
      }),
    );
  }

  getLocationByOrganizationId(organizationId: string): Observable<LocationProfile> {
    return from(
      getLocationByOrgIdApiV1LocationsIdOrganizationIdGet({
        client: this.client,
        path: { organization_id: Number(organizationId) },
      }),
    ).pipe(
      map((response) => {
        if (response.error) {
          throw response;
        }
        return (response.data as LocationResponse).location as LocationProfile;
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
              disclosesToCDP: true,
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
}
