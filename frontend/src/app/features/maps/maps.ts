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

  private subscriptions: Subscription[] = [];

  constructor(
    private mapSelectionService: MapSelectionService,
    private locationPinsService: LocationPinsService,
    private ngZone: NgZone,
    private googleMapsLoader: GoogleMapsLoaderService,
  ) {}

  ngOnInit(): void {
    this.googleMapsLoader.loadApi().subscribe((loaded) => {
      if (loaded) {
        this.initMap();
      }
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

  private initMap(): void {
    const isDesktop = this.isDesktop();
    const initialZoom = isDesktop ? 1.75 : 1.25;
    const mapOptions: google.maps.MapOptions = {
      center: { lat: 20, lng: -20 },
      zoom: initialZoom,
      minZoom: initialZoom,
      maxZoom: 10,
      mapId: 'f9ca03d789a382f6c5712958',
      restriction: {
        latLngBounds: {
          north: 85.05,
          south: -85.05,
          west: -180,
          east: 180,
        },
      },
      isFractionalZoomEnabled: true,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
    };
    this.googleMap = new window.google.maps.Map(this.mapElementRef.nativeElement, mapOptions);

    this.addStaticPins();
  }

  private addStaticPins(): void {
    this.subscriptions.push(
      this.locationPinsService.getAllLocationPins().subscribe({
        next: (pins) => {
          pins.forEach((location) => this.addPin(location));
        },
        error: (err) => console.error('Failed to load location pins:', err),
      }),
    );
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
    if (this.googleMap) {
      const isDesktop = this.isDesktop();
      const initialZoom = isDesktop ? 1.75 : 1.25;

      this.googleMap.panTo({ lat: 20, lng: -20 });
      google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
        this.googleMap.setZoom(initialZoom);
      });
    }
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
