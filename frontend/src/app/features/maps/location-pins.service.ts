import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { getAllLocationPinsApiV1LocationPinsGet, LocationPin } from '@pac-api/client';
import { createClient, createConfig } from '@pac-api/client/client';
import { environment } from '@env/environment';

@Injectable({
  providedIn: 'root',
})
export class LocationPinsService {
  private client = createClient(
    createConfig({
      baseUrl: environment.baseUrl,
    }),
  );

  constructor() {}

  getAllLocationPins(): Observable<LocationPin[]> {
    return from(
      getAllLocationPinsApiV1LocationPinsGet({
        client: this.client,
      }).then((res) => {
        if (res.error) {
          throw res.error;
        }
        return (res.data || []) as LocationPin[];
      }),
    );
  }
}
