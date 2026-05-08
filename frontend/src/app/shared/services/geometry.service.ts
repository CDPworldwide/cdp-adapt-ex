import { Injectable } from '@angular/core';
import { GoogleMapsLoaderService } from './google-maps-loader.service';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class GeometryService {
  constructor(private googleMapsLoader: GoogleMapsLoaderService) {}

  /**
   * Calculates the LatLngBounds of a GeoJSON-like geometry object.
   * Ensures the Google Maps API is loaded before performing calculations.
   * @param geometry The geometry object (e.g., from LocationProfile.geometry).
   * @returns An observable that emits the calculated LatLngBounds or undefined if not possible.
   */
  calculateBounds(geometry: {
    [key: string]: unknown;
  }): Observable<google.maps.LatLngBounds | undefined> {
    return this.googleMapsLoader.loadApi().pipe(
      map(() => {
        if (!geometry) {
          return undefined;
        }

        // Return undefined for point geometries so the caller can fall back to
        // setCenter + zoom.
        const innerType =
          geometry['type'] === 'Feature'
            ? ((geometry['geometry'] as { type?: string } | undefined)?.type ?? null)
            : (geometry['type'] as string | undefined);
        if (innerType === 'Point') {
          return undefined;
        }

        const bounds = new window.google.maps.LatLngBounds();

        try {
          const data = new window.google.maps.Data();
          let geoJsonData = geometry;

          // addGeoJson expects a Feature or FeatureCollection. If we get a raw
          // geometry, wrap it in a Feature.
          if (geometry['type'] !== 'Feature' && geometry['type'] !== 'FeatureCollection') {
            geoJsonData = { type: 'Feature', geometry: geometry, properties: {} };
          }

          data.addGeoJson(geoJsonData);

          data.forEach((feature) => {
            feature.getGeometry()?.forEachLatLng((latLng) => bounds.extend(latLng));
          });
        } catch (e) {
          console.error('Error calculating bounds from geometry:', e, geometry);
          return undefined;
        }

        return !bounds.isEmpty() ? bounds : undefined;
      }),
    );
  }
}
