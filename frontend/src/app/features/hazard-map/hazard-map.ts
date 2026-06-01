import {
  Component,
  Input,
  OnInit,
  AfterViewInit,
  ViewChild,
  ElementRef,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  Renderer2,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HazardEnum, ScenarioEnum, YearRange } from '@pac-api/client';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { HazardIconComponent } from '../../shared/components/hazard-icon/hazard-icon.component';
import { InfoIconComponent } from '../../shared/icons/info-icon.component';
import { HazardColorPaletteComponent } from './hazard-legend/hazard-color-palette.component';
import { HazardMapService } from './hazard-map.service';
import { GoogleMapsLoaderService } from '../../shared/services/google-maps-loader.service';
import { HazardLayerOptions } from '@pac-api/client';

export const SUPPORTED_HAZARD_TYPES: HazardEnum[] = [
  HazardEnum.WATER_STRESS,
  HazardEnum.RIVER_FLOODING,
  HazardEnum.COASTAL_FLOODING,
  HazardEnum.FIRE_WEATHER,
  HazardEnum.HEAT_STRESS,
  HazardEnum.EXTREME_HEAT,
  HazardEnum.EXTREME_COLD,
  HazardEnum.HEAVY_PRECIPITATION,
  HazardEnum.SOIL_DEGRADATION_EROSION,
];

const SCENARIO_LABELS: Partial<Record<ScenarioEnum, string>> = {
  [ScenarioEnum.SSP126]: 'SSP1 - 2.6',
  [ScenarioEnum.SSP245]: 'SSP2 - 4.5',
  [ScenarioEnum.SSP370]: 'SSP3 - 7.0',
  [ScenarioEnum.SSP585]: 'SSP5 - 8.5',
};

// WRI Aqueduct flood data is published with RCP scenarios (CMIP5-era), so the
// flood layers carry the SSP enum from backend but labelled as their
// RCP equivalents in the UI.
const FLOOD_HAZARDS = new Set<HazardEnum>([
  HazardEnum.COASTAL_FLOODING,
  HazardEnum.RIVER_FLOODING,
]);

const FLOOD_SCENARIO_LABELS: Partial<Record<ScenarioEnum, string>> = {
  [ScenarioEnum.SSP245]: 'RCP 4.5',
  [ScenarioEnum.SSP585]: 'RCP 8.5',
};

@Component({
  selector: 'app-hazard-map',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIcon,
    MatTooltipModule,
    HazardIconComponent,
    HazardColorPaletteComponent,
    InfoIconComponent,
    TranslateModule,
  ],
  templateUrl: './hazard-map.html',
  styles: [':host { display: block; width: 100%; height: 100%; }'],
})
export class HazardMapComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('map', { static: true }) mapElementRef!: ElementRef;
  @Input({ required: true }) lat!: number;
  @Input({ required: true }) lng!: number;
  @Input() zoom: number = 5;
  @Input() hazardType?: HazardEnum;
  @Input() showExpand: boolean = true;
  @Input() static: boolean = false;
  @Input() grayscale: boolean = true;
  @Input() locationName?: string;
  @Input() geometry?: { [key: string]: unknown };
  @Input() calculatedBounds?: google.maps.LatLngBounds;

  private googleMap!: google.maps.Map;
  private jurisdictionLayer?: google.maps.Data;
  private hazardLayerConfig: Partial<Record<HazardEnum, HazardLayerOptions>> = {};
  private isMapInitialized = false;
  private destroy$ = new Subject<void>();
  isExpanded = false;
  // Mobile only: the expanded-map legend opens as a collapsed bottom sheet
  // (header + colour scale) and expands to the full card on tap/drag-up.
  // Desktop always shows the full legend (see `md:block` in the template).
  legendExpanded = false;
  private legendTouchStartY: number | null = null;

  // Scenario picker
  scenarios: ScenarioEnum[] = [];
  selectedScenario!: ScenarioEnum;

  // Year range picker
  yearRanges: YearRange[] = [];
  selectedYearRange!: YearRange;

  palette: string[] = [];
  hazardSource: string | undefined;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
    private hazardMapService: HazardMapService,
    private googleMapsLoader: GoogleMapsLoaderService,
    private translateService: TranslateService,
  ) {}

  ngOnInit(): void {
    this.hazardMapService.getHazardLayerConfig().subscribe((config) => {
      this.hazardLayerConfig = config;
      this.updateHazardOptions();
    });

    this.googleMapsLoader.loadApi().subscribe((loaded) => {
      if (loaded) {
        this.initMap();
      }
    });
  }

  ngAfterViewInit(): void {
    // Map will be initialized by the Google Maps script callback or if script is already loaded
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update map center if coordinates change after initialization
    if (this.isMapInitialized && (changes['lat'] || changes['lng'])) {
      this.updateMapCenter();
    }
    if (changes['hazardType']) {
      this.updateHazardOptions();
      this.renderJurisdictionBoundary();
      if (this.googleMap) {
        this.googleMap.setOptions({
          styles: this.getMapStyles(),
          ...this.getInteractivityOptions(),
        });
      }
    }
    if (changes['geometry'] || changes['calculatedBounds']) {
      this.renderJurisdictionBoundary();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.googleMap) {
      this.googleMap = null!;
    }
  }

  private initMap(): void {
    if (!this.mapElementRef?.nativeElement || this.lat === undefined || this.lng === undefined) {
      return;
    }

    const mapOptions: google.maps.MapOptions = {
      center: { lat: this.lat, lng: this.lng },
      zoom: this.zoom,
      mapTypeId: window.google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: true,
      styles: this.getMapStyles(),
      ...this.getInteractivityOptions(),
    };

    this.googleMap = new window.google.maps.Map(this.mapElementRef.nativeElement, mapOptions);

    this.renderHazardLayer();
    this.renderJurisdictionBoundary();
    this.isMapInitialized = true;
  }

  private updateMapCenter(): void {
    if (this.googleMap && this.lat !== undefined && this.lng !== undefined) {
      this.googleMap.setCenter({ lat: this.lat, lng: this.lng });
    }
  }

  private getMapStyles(): google.maps.MapTypeStyle[] {
    const isSupported = this.isHazardSupported(this.hazardType);
    let styles: google.maps.MapTypeStyle[] = [];

    if (this.grayscale) {
      styles = [
        {
          // Desaturate and lighten the entire map
          stylers: [{ saturation: -100 }, { lightness: 20 }],
        },
        {
          // Style all administrative borders with black
          featureType: 'administrative',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#000000' }, { weight: 1.5 }],
        },
      ];
    } else {
      styles = [
        {
          stylers: [{ saturation: -10 }],
        },
      ];
    }

    if (this.hazardType && !isSupported) {
      styles.push({
        featureType: 'all',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      });
    }

    return styles;
  }

  private getInteractivityOptions(): google.maps.MapOptions {
    const isSupported = this.isHazardSupported(this.hazardType);
    const isInteractive = !this.static && isSupported && this.isExpanded;

    return {
      zoomControl: isInteractive,
      gestureHandling: isInteractive ? 'cooperative' : 'none',
      draggable: isInteractive,
      keyboardShortcuts: isInteractive,
    };
  }

  toggleLegend(): void {
    this.legendExpanded = !this.legendExpanded;
  }

  onLegendTouchStart(event: TouchEvent): void {
    this.legendTouchStartY = event.touches[0]?.clientY ?? null;
  }

  onLegendTouchMove(event: TouchEvent): void {
    if (this.legendTouchStartY === null) return;
    const currentY = event.touches[0]?.clientY;
    if (currentY === undefined) return;
    const deltaY = currentY - this.legendTouchStartY;
    const THRESHOLD_PX = 30;
    if (deltaY < -THRESHOLD_PX && !this.legendExpanded) {
      this.legendExpanded = true;
      this.legendTouchStartY = null;
    } else if (deltaY > THRESHOLD_PX && this.legendExpanded) {
      this.legendExpanded = false;
      this.legendTouchStartY = null;
    }
  }

  onLegendTouchEnd(): void {
    this.legendTouchStartY = null;
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    const host = this.el.nativeElement;
    if (this.isExpanded) {
      // Always (re)open the legend collapsed so the map is unobstructed.
      this.legendExpanded = false;
      this.renderer.setStyle(host, 'position', 'fixed');
      this.renderer.setStyle(host, 'inset', '0');
      this.renderer.setStyle(host, 'width', '100vw');
      this.renderer.setStyle(host, 'height', '100vh');
      this.renderer.setStyle(host, 'z-index', '9999');
      this.renderer.setStyle(host, 'background', 'white');
    } else {
      this.renderer.removeStyle(host, 'position');
      this.renderer.removeStyle(host, 'inset');
      this.renderer.removeStyle(host, 'width');
      this.renderer.removeStyle(host, 'height');
      this.renderer.removeStyle(host, 'z-index');
      this.renderer.removeStyle(host, 'background');
    }
    if (this.googleMap) {
      this.googleMap.setOptions(this.getInteractivityOptions());
    }
    // Trigger map resize after expansion/collapse to ensure proper rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this.googleMap) {
          window.google.maps.event.trigger(this.googleMap, 'resize');
          // Fit to geometry after resize if available
          if (this.calculatedBounds) {
            this.googleMap.fitBounds(this.calculatedBounds);
          } else if (this.lat !== undefined && this.lng !== undefined) {
            this.googleMap.setCenter({ lat: this.lat, lng: this.lng });
          }
        }
      });
    });
  }

  private updateHazardOptions(): void {
    if (this.hazardType && this.isHazardSupported(this.hazardType)) {
      const options = this.hazardLayerConfig[this.hazardType];
      if (options) {
        this.scenarios = options.scenarios;
        this.selectedScenario = this.scenarios[0];
        this.palette = options.palette || [];
        this.hazardSource = options.source || '';
        this.updateYearRangesForScenario();
        this.renderHazardLayer();
      }
    }
  }

  private renderHazardLayer(): void {
    if (!this.googleMap || !this.hazardType || !this.isHazardSupported(this.hazardType)) {
      return;
    }

    // Clear previous overlay
    if (this.googleMap.overlayMapTypes.getLength() > 0) {
      this.googleMap.overlayMapTypes.clear();
    }

    this.hazardMapService
      .getHazardLayer(
        this.hazardType,
        this.selectedScenario,
        this.selectedYearRange?.start,
        this.selectedYearRange?.end,
      )
      .pipe(takeUntil(this.destroy$))
      .subscribe((hazard) => {
        if (hazard && this.googleMap) {
          this.googleMap.overlayMapTypes.push(hazard);
        }
      });
  }

  private renderJurisdictionBoundary(): void {
    if (this.jurisdictionLayer) {
      this.jurisdictionLayer.setMap(null);
      this.jurisdictionLayer = undefined;
    }

    if (this.googleMap) {
      // Render the jurisdiction polygon whenever geometry is present, even if
      // the currently-selected hazard has no GEE tile.
      if (this.geometry) {
        this.jurisdictionLayer = new window.google.maps.Data();
        const feature: { type: string; geometry: { [key: string]: unknown } } = {
          type: 'Feature',
          geometry: this.geometry,
        };
        this.jurisdictionLayer.addGeoJson(feature);
        this.jurisdictionLayer.setStyle({
          strokeColor: '#000000',
          strokeWeight: 2,
          fillOpacity: 0,
        });
        this.jurisdictionLayer.setMap(this.googleMap);
      }

      if (this.calculatedBounds) {
        this.googleMap.fitBounds(this.calculatedBounds);
      } else if (this.lat !== undefined && this.lng !== undefined) {
        this.googleMap.setCenter({ lat: this.lat, lng: this.lng });
      }
    }
  }

  isHazardSupported(hazardType: HazardEnum | undefined): boolean {
    if (!hazardType) {
      return false;
    }
    return SUPPORTED_HAZARD_TYPES.includes(hazardType);
  }

  onScenarioChange(scenario: ScenarioEnum): void {
    this.selectedScenario = scenario;
    this.updateYearRangesForScenario();
    this.renderHazardLayer();
  }

  private updateYearRangesForScenario(): void {
    if (!this.hazardType || !this.hazardLayerConfig[this.hazardType]) {
      return;
    }
    const options = this.hazardLayerConfig[this.hazardType]!;

    this.yearRanges =
      this.selectedScenario === ScenarioEnum.HISTORICAL && options.historical_year_range
        ? [options.historical_year_range]
        : options.year_ranges || [];

    const isSelectedYearRangeValid = this.yearRanges.some(
      (yr) => yr.start === this.selectedYearRange?.start && yr.end === this.selectedYearRange?.end,
    );

    if (!isSelectedYearRangeValid) {
      this.selectedYearRange = this.yearRanges[0];
    }
  }

  onYearRangeChange(yearRange: YearRange): void {
    this.selectedYearRange = yearRange;
    this.renderHazardLayer();
  }

  formatYearRangeLabel(yearRange: YearRange): string {
    if (yearRange.start === yearRange.end) {
      return String(yearRange.start);
    }
    return `${yearRange.start} - ${yearRange.end}`;
  }

  formatScenarioLabel(scenario: ScenarioEnum): string {
    if (scenario === ScenarioEnum.HISTORICAL) {
      return this.translateService.instant('maps.scenarios.historical');
    }

    if (this.hazardType && FLOOD_HAZARDS.has(this.hazardType)) {
      return FLOOD_SCENARIO_LABELS[scenario] ?? SCENARIO_LABELS[scenario] ?? scenario;
    }
    return SCENARIO_LABELS[scenario] ?? scenario;
  }
}
