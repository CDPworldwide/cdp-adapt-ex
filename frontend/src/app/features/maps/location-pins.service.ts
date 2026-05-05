import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import {
  getAllLocationPinsApiV1LocationsPinsGet,
  LocationPin,
  LocationPinsResponse,
} from '@pac-api/client';
import { createApiClient } from '../../shared/services/api-client';

@Injectable({
  providedIn: 'root',
})
export class LocationPinsService {
  private client = createApiClient();

  constructor() {}

  getAllLocationPins(): Observable<LocationPin[]> {
    return from(
      getAllLocationPinsApiV1LocationsPinsGet({
        client: this.client,
      }).then((res) => {
        if (res.error) {
          throw res.error;
        }
        return ((res.data as LocationPinsResponse)?.pins || []) as LocationPin[];
      }),
    );
  }
}
