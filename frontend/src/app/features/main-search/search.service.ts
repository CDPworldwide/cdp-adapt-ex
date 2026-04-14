import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LocationService } from '../../shared/services/location.service';
import type { LocationProfile } from '@pac-api/client';

// Re-export LocationProfile as LocationData for backwards compatibility
export type LocationData = LocationProfile;

@Injectable({
  providedIn: 'root',
})
export class SearchService {
  constructor(private locationService: LocationService) {}

  searchLocation(query: string): Observable<LocationData> {
    return this.locationService.getLocation(query);
  }
}
