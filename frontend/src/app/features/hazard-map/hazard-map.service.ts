import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, from, Observable, of } from 'rxjs';
import { catchError, map, switchMap, shareReplay } from 'rxjs/operators';
import {
  TileHazardLayerData,
  HazardEnum,
  ScenarioEnum,
  getEeHazardLayerApiV1HazardsHazardTypeGet,
  getHazardLayerConfigApiV1HazardsLayerConfigGet,
  HazardLayerOptions,
  HazardLayerResponse,
  HazardLayerConfigResponse,
} from '@pac-api/client';
import { GoogleMapsLoaderService } from '../../shared/services/google-maps-loader.service';
import { createApiClient } from '../../shared/services/api-client';
import { SUPPORTED_HAZARD_TYPES } from './hazard-map';

@Injectable({
  providedIn: 'root',
})
export class HazardMapService {
  // Cache to store requested hazard layers when preloading.
  private hazardLayerRequestCache = new Map<string, Observable<google.maps.ImageMapType | null>>();
  private hazardLayerConfigCache: Observable<
    Partial<Record<HazardEnum, HazardLayerOptions>>
  > | null = null;

  private client = createApiClient();

  constructor(
    private http: HttpClient,
    private googleMapsLoader: GoogleMapsLoaderService,
  ) {}

  getHazardLayerConfig(): Observable<Partial<Record<HazardEnum, HazardLayerOptions>>> {
    if (this.hazardLayerConfigCache) {
      return this.hazardLayerConfigCache;
    }

    const newRequest$ = from(
      getHazardLayerConfigApiV1HazardsLayerConfigGet({
        client: this.client,
      }),
    ).pipe(
      map((response) => (response.data as HazardLayerConfigResponse)?.config || {}),
      catchError((error) => {
        console.error('Error loading hazard layer config:', error);
        return of({});
      }),
      shareReplay(1),
    );

    this.hazardLayerConfigCache = newRequest$;
    return newRequest$;
  }

  // Preload all historical hazard layers to show as the default layer
  preloadHazardLayers(): Observable<void> {
    return this.googleMapsLoader.loadApi().pipe(
      switchMap(() => {
        const observables = SUPPORTED_HAZARD_TYPES.map((hazardType) =>
          this.getHazardLayer(hazardType, ScenarioEnum.HISTORICAL),
        );

        return forkJoin(observables).pipe(
          map(() => void 0),
          catchError((error) => {
            console.error('Failed to preload one or more hazard layers', error);
            return of(void 0);
          }),
        );
      }),
    );
  }

  getHazardLayer(
    hazardType: HazardEnum,
    scenario: ScenarioEnum = ScenarioEnum.HISTORICAL,
    startYear?: number,
    endYear?: number,
  ): Observable<google.maps.ImageMapType | null> {
    const cacheKey = `${hazardType}-${scenario}-${startYear || 'na'}-${endYear || 'na'}`;
    if (this.hazardLayerRequestCache.has(cacheKey)) {
      return this.hazardLayerRequestCache.get(cacheKey)!;
    }

    const newRequest$ = from(
      getEeHazardLayerApiV1HazardsHazardTypeGet({
        client: this.client,
        path: { hazard_type: hazardType },
        query: { scenario: scenario, start_year: startYear, end_year: endYear },
      }),
    ).pipe(
      map((response) => {
        const hazardData = (response.data as HazardLayerResponse)?.layer?.hazard_data;
        if (!this.isTileHazardLayerData(hazardData)) {
          console.error(`Unsupported hazard data type or missing data for ${hazardType}`);
          return null;
        }

        return new google.maps.ImageMapType({
          getTileUrl: (tile: google.maps.Point, zoom: number) => {
            return hazardData.tile_url
              .replace('{x}', tile.x.toString())
              .replace('{y}', tile.y.toString())
              .replace('{z}', zoom.toString());
          },
          tileSize: new google.maps.Size(256, 256),
          name: (response.data as HazardLayerResponse)?.layer?.name || 'Hazard Layer',
          opacity: 0.7,
        });
      }),
      catchError((error) => {
        console.error(`Error loading Earth Engine layer for ${hazardType}:`, error);
        return of(null);
      }),
      shareReplay(1),
    );
    this.hazardLayerRequestCache.set(cacheKey, newRequest$);
    return newRequest$;
  }

  private isTileHazardLayerData(data: any): data is TileHazardLayerData {
    return data && data.type === 'tile' && typeof data.tile_url === 'string';
  }
}
