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
import { Router } from '@angular/router';
import { MapSelectionService } from '../main-search/map-selection.service';
import { SearchService, LocationData } from '../main-search/search.service';
import { LocationSummaryComponent } from './location-summary/location-summary.component';
import { LocationPinsService } from './location-pins.service';
import { ActionStatusEnum, OrgTypeEnum } from '@pac-api/client';
import type { AdaptationAction, Hazard, HazardProfile, LocationPin } from '@pac-api/client';
import { Subscription, of } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';
import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { GoogleMapsLoaderService } from 'src/app/shared/services/google-maps-loader.service';

const CITY_PIN_ICON_URL = '/assets/icons/cdp_map_pin-red.svg';
const REGION_PIN_ICON_URL = '/assets/icons/cdp_map_pin-blue.svg';
const CITY_PIN_SELECTED_ICON_URL = '/assets/icons/cdp_map_pin-red-selected.svg';
const REGION_PIN_SELECTED_ICON_URL = '/assets/icons/cdp_map_pin-blue-selected.svg';

@Component({
  selector: 'app-maps',
  imports: [LocationSummaryComponent],
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

  selectedLocation: LocationPin | null = null;
  fullLocationData: LocationData | null = null;
  totalHazardsCount = 0;
  implementedActionsCount = 0;
  projectsRequiringFundingCount = 0;
  topFourHazards: Hazard[] = [];
  locationSuggestions: LocationSuggestion[] = [];

  isLoadingHazardData = false;

  private subscriptions: Subscription[] = [];

  constructor(
    private mapSelectionService: MapSelectionService,
    private router: Router,
    private searchService: SearchService,
    private locationService: LocationService,
    private locationPinsService: LocationPinsService,
    private ngZone: NgZone,
    private googleMapsLoader: GoogleMapsLoaderService,
  ) {}

  ngOnInit(): void {
    this.googleMapsLoader.loadApi().subscribe(() => this.initMap());

    this.subscriptions.push(
      this.locationService.getAllLocationNames().subscribe((suggestions) => {
        this.locationSuggestions = suggestions;
      }),
    );

    const locationDetails$ = this.mapSelectionService.selectedMapLocation$.pipe(
      tap((location) => {
        this.selectedLocation = location;
        if (!location) {
          this.resetMap();
        } else {
          this.fullLocationData = null;
          this.totalHazardsCount = 0;
          this.implementedActionsCount = 0;
          this.projectsRequiringFundingCount = 0;
          this.topFourHazards = [];
          this.isLoadingHazardData = true;
        }
        this.updateMarkerIcons(location);
      }),
      filter((location): location is LocationPin => location !== null),
      switchMap((location) =>
        this.searchService.searchLocation(location.name).pipe(
          tap(() => (this.isLoadingHazardData = false)),
          catchError((err) => {
            console.error('Error fetching location details:', err);
            this.isLoadingHazardData = false;
            return of(null);
          }),
        ),
      ),
    );

    this.subscriptions.push(
      locationDetails$.subscribe((data) => {
        if (data) {
          this.processLocationData(data);
        }
      }),
    );
  }

  private processLocationData(data: LocationData): void {
    this.fullLocationData = data;
    this.totalHazardsCount = data.hazards?.hazards?.length || 0;
    this.implementedActionsCount =
      data.governmentActions?.actions?.filter(
        (action: AdaptationAction) =>
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_JURISDICTION_WIDE ||
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_MOST_OF_JURISDICTION ||
          action.status?.statusType === ActionStatusEnum.ACTION_IN_OPERATION_TARGETED,
      ).length || 0;
    this.projectsRequiringFundingCount = data.governmentActions?.projects?.length || 0;
    this.topFourHazards = (data.hazards?.hazards || [])
      .map((hazardProfile: HazardProfile) => hazardProfile.hazard)
      .slice(0, 4);
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
    const initialZoom = isDesktop ? 2.5 : 1.75;
    const mapOptions: google.maps.MapOptions = {
      center: { lat: 20, lng: 10 },
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

    this.googleMap.addListener('click', () => {
      this.ngZone.run(() => {
        this.mapSelectionService.setMapClicked(true);
      });
    });

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
    const isSelected = this.selectedLocation?.name === location.name;
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

  goToLocationDetails(): void {
    if (!this.selectedLocation) {
      return;
    }

    const suggestion = this.locationSuggestions.find(
      (location) => location.name === this.selectedLocation?.name,
    );

    if (suggestion) {
      this.mapSelectionService.clearSelection();
      this.router.navigate(['/org', suggestion.organizationId]);
    }
  }

  closeCard(): void {
    this.mapSelectionService.clearSelection();
  }

  private resetMap(): void {
    if (this.googleMap) {
      const isDesktop = this.isDesktop();
      const initialZoom = isDesktop ? 2.5 : 1.75;

      this.googleMap.panTo({ lat: 20, lng: 10 });
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
