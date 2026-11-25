import { inject, Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  getAllLocationPinsApiV1LocationsPinsGet,
  LocationPin,
  LocationPinsResponse,
} from '@pac-api/client';
import { createApiClient } from '../../shared/services/api-client';
import { DisclosingYearService } from 'src/app/shared/services/disclosing-year.service';

@Injectable({
  providedIn: 'root',
})
export class LocationPinsService {
  private client = createApiClient();
  private readonly disclosingYearService = inject(DisclosingYearService);

  constructor() {}

  getAllLocationPins(disclosingYear: number): Observable<LocationPin[]> {
    return from(
      getAllLocationPinsApiV1LocationsPinsGet({
        client: this.client,
        query: { disclosing_year: disclosingYear },
      }).then((res) => {
        if (res.error) {
          throw res.error;
        }
        return ((res.data as LocationPinsResponse)?.pins || []) as LocationPin[];
      }),
    );
  }
}
