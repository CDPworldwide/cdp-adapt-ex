import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { MapSelectionService } from '../main-search/map-selection.service';
import { LocationPinsService } from './location-pins.service';
import { OrgTypeEnum } from '@pac-api/client';
import type { LocationPin } from '@pac-api/client';
import { Subscription } from 'rxjs';
import { GoogleMapsLoaderService } from 'src/app/shared/services/google-maps-loader.service';

// Circle-on-stick pin shape (a filled disc with a vertical bar trailing
// downward). Single fill — the selected variant uses a darker shade.
const PIN_PATH =
  'M4.6665 0.00130224C2.08918 0.00130209 -0.000162543 2.09064 -0.000162601 4.66797' +
  'C-0.00016266 7.2453 2.08917 9.33464 4.6665 9.33464C7.24383 9.33464 9.33317 7.2453 9.33317 4.66797' +
  'C9.33317 2.09064 7.24383 0.0013024 4.6665 0.00130224Z' +
  'M4.6665 4.66797L3.7915 4.66797L3.7915 23.6781L4.6665 23.6781L5.5415 23.6781L5.5415 4.66797L4.6665 4.66797Z';
const pinDataUrl = (fill: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 24" width="10" height="24"><path d="${PIN_PATH}" fill="${fill}"/></svg>`,
  );

const CITY_FILL = '#E81647';
const CITY_FILL_SELECTED = '#A12638';
const REGION_FILL = '#00A6FF';
const REGION_FILL_SELECTED = '#0082C7';

const CITY_PIN_ICON_URL = pinDataUrl(CITY_FILL);
const REGION_PIN_ICON_URL = pinDataUrl(REGION_FILL);
const CITY_PIN_SELECTED_ICON_URL = pinDataUrl(CITY_FILL_SELECTED);
const REGION_PIN_SELECTED_ICON_URL = pinDataUrl(REGION_FILL_SELECTED);

@Component({
  selector: 'app-maps',
  imports: [],
  templateUrl: './maps.html',
  styleUrls: ['../shared-feature-styles.css', './maps.css'],
})
export class Maps implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('map', { static: true }) mapElementRef!: ElementRef;
  private googleMap!: google.maps.Map;
  private markers: Map<
    string,
    { marker: google.maps.marker.AdvancedMarkerElement; orgType: OrgTypeEnum }
  > = new Map();

  // Computed from the actual pin set after pins load. Used as the "global view"
  // for resetMap() and to clamp minZoom so the user can't dolly out to blank
  // sky/ocean beyond the pin cohort.
  private defaultZoom: number | null = null;
  private defaultCenter: google.maps.LatLngLiteral | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private mapSelectionService: MapSelectionService,
    private locationPinsService: LocationPinsService,
    private ngZone: NgZone,
    private googleMapsLoader: GoogleMapsLoaderService,
  ) {}

  ngOnInit(): void {
    this.googleMapsLoader.loadApi().subscribe((loaded) => {
      if (!loaded) return;
      // Load pins first so the map can boot at the fitted zoom level instead
      // of animating in from a wider initial view.
      this.subscriptions.push(
        this.locationPinsService.getAllLocationPins().subscribe({
          next: (pins) => {
            this.initMap(pins);
            pins.forEach((location) => this.addPin(location));
          },
          error: (err) => {
            console.error('Failed to load location pins:', err);
            this.initMap([]);
          },
        }),
      );
    });

    this.subscriptions.push(
      this.mapSelectionService.selectedMapLocation$.subscribe((location) => {
        if (!location) {
          this.resetMap();
        }
        this.updateMarkerIcons(location);
      }),
    );
  }

  ngAfterViewInit(): void {}

  private isDesktop(): boolean {
    return window.innerWidth >= 768;
  }

  ngOnDestroy(): void {
    if (this.googleMap) {
      this.googleMap = null!;
    }

    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private initMap(pins: LocationPin[]): void {
    const isDesktop = this.isDesktop();
    const { center, zoom } = this.computeFit(pins, isDesktop);
    this.defaultCenter = center;
    this.defaultZoom = zoom;

    const mapOptions: google.maps.MapOptions = {
      center,
      zoom,
      minZoom: zoom,
      maxZoom: 10,
      mapId: 'f9ca03d789a382f6c5712958',
      // Hard-clamp the camera to a single world copy so we never expose blank
      // duplicate worlds. AdvancedMarkerElement normalizes lng to [-180, 180]
      // and only renders in the canonical world copy, so showing duplicate
      // worlds would otherwise leave the extra copies empty of pins.
      restriction: {
        latLngBounds: {
          north: 85.05,
          south: -85.05,
          west: -180,
          east: 180,
        },
        strictBounds: true,
      },
      isFractionalZoomEnabled: true,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    };
    this.googleMap = new window.google.maps.Map(this.mapElementRef.nativeElement, mapOptions);
  }

  // Compute the center + zoom that frames every pin inside the current
  // container, using the Web Mercator projection math directly so we can apply
  // it at map-construction time (no fitBounds animation).
  private computeFit(
    pins: LocationPin[],
    isDesktop: boolean,
  ): { center: google.maps.LatLngLiteral; zoom: number } {
    const fallbackZoom = isDesktop ? 2 : 1.25;
    const fallback = { center: { lat: 20, lng: -20 }, zoom: fallbackZoom };
    if (pins.length === 0) return fallback;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;
    for (const p of pins) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    const el = this.mapElementRef.nativeElement as HTMLElement;
    const padding = isDesktop ? 40 : 16;
    const containerW = Math.max(1, el.offsetWidth - padding * 2);
    const containerH = Math.max(1, el.offsetHeight - padding * 2);

    // Web Mercator y, normalized to [0, 1].
    const latY = (lat: number): number => {
      const clamped = Math.max(Math.min(lat, 85.05), -85.05);
      const sin = Math.sin((clamped * Math.PI) / 180);
      return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    };

    const lngFraction = Math.max(1e-6, (maxLng - minLng) / 360);
    const latFraction = Math.max(1e-6, latY(minLat) - latY(maxLat));

    const zoomX = Math.log2(containerW / 256 / lngFraction);
    const zoomY = Math.log2(containerH / 256 / latFraction);
    const zoom = Math.max(1, Math.min(10, Math.min(zoomX, zoomY)));

    return {
      center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
      zoom,
    };
  }

  private addPin(location: LocationPin): void {
    const isSelected = this.mapSelectionService.getSelectedLocation()?.name === location.name;
    const orgType = location.orgType ?? OrgTypeEnum.CITY;
    const { iconUrl, width, height, zIndex } = this.getPinStyle(orgType, isSelected);

    const pinIcon = document.createElement('img');
    pinIcon.src = iconUrl;
    pinIcon.style.width = `${width}px`;
    pinIcon.style.height = `${height}px`;

    const marker = new window.google.maps.marker.AdvancedMarkerElement({
      position: { lat: location.lat, lng: location.lng },
      map: this.googleMap,
      title: location.name,
      zIndex,
      content: pinIcon,
    });

    this.markers.set(location.name, { marker, orgType });

    marker.addListener('click', () => {
      this.ngZone.run(() => {
        const zoomLevel = 8;
        const mapHeight = this.mapElementRef.nativeElement.offsetHeight;
        const offsetPixels = mapHeight / 4;
        const metersPerPixel =
          (156543.03392 * Math.cos((location.lat * Math.PI) / 180)) / Math.pow(2, zoomLevel);
        const offsetMeters = offsetPixels * metersPerPixel;
        const newCenter = google.maps.geometry.spherical.computeOffset(
          new google.maps.LatLng(location.lat, location.lng),
          offsetMeters,
          180,
        );

        this.googleMap.panTo(newCenter!);

        google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
          this.googleMap.setZoom(zoomLevel);
        });

        this.mapSelectionService.selectLocation(location);
      });
    });
  }

  private resetMap(): void {
    if (!this.googleMap) return;
    const center = this.defaultCenter ?? { lat: 20, lng: -20 };
    const zoom = this.defaultZoom ?? (this.isDesktop() ? 2 : 1.25);
    this.googleMap.panTo(center);
    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
      this.googleMap.setZoom(zoom);
    });
  }

  private getPinStyle(orgType: OrgTypeEnum, isSelected: boolean) {
    const isDesktop = this.isDesktop();
    const isRegion = orgType === OrgTypeEnum.STATE_AND_REGION;
    const scale = isSelected ? 1.25 : 1;

    const iconUrl = isSelected
      ? isRegion
        ? REGION_PIN_SELECTED_ICON_URL
        : CITY_PIN_SELECTED_ICON_URL
      : isRegion
        ? REGION_PIN_ICON_URL
        : CITY_PIN_ICON_URL;

    // The pin SVG has a 10:24 aspect ratio (circle on top, bar trailing down).
    const pinHeight = isDesktop ? 32 : 24;
    return {
      iconUrl,
      width: Math.round(((pinHeight * 10) / 24) * scale),
      height: Math.round(pinHeight * scale),
      // Make sure the selected pin is always on top of other pins
      zIndex: isSelected ? 10000 : 9999,
    };
  }

  private updateMarkerIcons(selectedLocation: LocationPin | null): void {
    this.markers.forEach((markerData, locationName) => {
      const isSelected = selectedLocation?.name === locationName;
      const { iconUrl, width, height, zIndex } = this.getPinStyle(markerData.orgType, isSelected);

      const pinIcon = markerData.marker.content as HTMLImageElement;
      if (pinIcon) {
        if (!pinIcon.src.endsWith(iconUrl)) {
          pinIcon.src = iconUrl;
        }

        pinIcon.style.width = `${width}px`;
        pinIcon.style.height = `${height}px`;
        markerData.marker.zIndex = zIndex;
      }
    });
  }
}
