import {
  Component,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MapSelectionService } from '../main-search/map-selection.service';
import { LocationPinsService } from './location-pins.service';
import { OrgTypeEnum } from '@pac-api/client';
import type { LocationPin } from '@pac-api/client';
import { Subscription } from 'rxjs';
import { GoogleMapsLoaderService } from 'src/app/shared/services/google-maps-loader.service';

// Single teardrop pin shape; selected variants reuse the stroke colour as the
// fill so they read as a darker version of the unselected pin.
const PIN_PATH = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z';
const pinDataUrl = (fill: string, stroke: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="${PIN_PATH}" fill="${fill}" stroke="${stroke}" stroke-width="1"/></svg>`,
  );

const CITY_FILL = '#EA1647';
const CITY_STROKE = '#A12638';
const REGION_FILL = '#00A6FF';
const REGION_STROKE = '#0082C7';

const CITY_PIN_ICON_URL = pinDataUrl(CITY_FILL, CITY_STROKE);
const REGION_PIN_ICON_URL = pinDataUrl(REGION_FILL, REGION_STROKE);
const CITY_PIN_SELECTED_ICON_URL = pinDataUrl(CITY_STROKE, CITY_STROKE);
const REGION_PIN_SELECTED_ICON_URL = pinDataUrl(REGION_STROKE, REGION_STROKE);

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
    this.googleMapsLoader.loadApi().subscribe(() => this.initMap());

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

    return {
      iconUrl,
      width: Math.round((isDesktop ? 32 : 24) * scale),
      height: Math.round((isDesktop ? 40 : 30) * scale),
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
