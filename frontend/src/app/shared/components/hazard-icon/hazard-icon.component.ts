import { Component, Input, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { HazardEnum } from '@pac-api/client';
import {
  HeatStressIconComponent,
  ExtremeHeatIconComponent,
  ExtremeColdIconComponent,
  SnowIceIconComponent,
  ExtremeWindIconComponent,
  ValveIconComponent,
  BiodiversityLossIconComponent,
  LossOfGreenSpaceIconComponent,
  StormIconComponent,
  HeavyPrecipitationIconComponent,
  DroughtIconComponent,
  UrbanFloodingIconComponent,
  RiverFloodingIconComponent,
  CoastalFloodingIconComponent,
  FireWeatherIconComponent,
  HurricanesTyphoonIconComponent,
  MassMovementIconComponent,
  SoilDegradationIconComponent,
  InfectiousDiseaseIconComponent,
  OtherLandscapeShiftIconComponent,
  OtherHazardIconComponent,
  WaterStressIconComponent,
} from '../../icons';

// TODO (#247): Remove Partial<> when all hazard icons are mapped
const HAZARD_ICON_MAP: Partial<Record<HazardEnum, Type<any>>> = {
  [HazardEnum.HEAT_STRESS]: HeatStressIconComponent,
  [HazardEnum.EXTREME_HEAT]: ExtremeHeatIconComponent,
  [HazardEnum.EXTREME_COLD]: ExtremeColdIconComponent,
  [HazardEnum.SNOW_AND_ICE]: SnowIceIconComponent,
  [HazardEnum.EXTREME_WIND]: ExtremeWindIconComponent,
  [HazardEnum.FIRE_WEATHER]: FireWeatherIconComponent,
  [HazardEnum.STORM]: StormIconComponent,
  [HazardEnum.HEAVY_PRECIPITATION]: HeavyPrecipitationIconComponent,
  [HazardEnum.WATER_STRESS]: WaterStressIconComponent,
  [HazardEnum.DROUGHT]: DroughtIconComponent,
  [HazardEnum.URBAN_FLOODING]: UrbanFloodingIconComponent,
  [HazardEnum.RIVER_FLOODING]: RiverFloodingIconComponent,
  [HazardEnum.COASTAL_FLOODING]: CoastalFloodingIconComponent,
  [HazardEnum.INCREASED_WATER_DEMAND]: ValveIconComponent,
  [HazardEnum.MASS_MOVEMENT]: MassMovementIconComponent,
  [HazardEnum.BIODIVERSITY_LOSS]: BiodiversityLossIconComponent,
  [HazardEnum.LOSS_OF_GREEN_SPACE]: LossOfGreenSpaceIconComponent,
  [HazardEnum.SOIL_DEGRADATION_EROSION]: SoilDegradationIconComponent,
  [HazardEnum.INFECTIOUS_DISEASE]: InfectiousDiseaseIconComponent,
  [HazardEnum.TROPICAL_CYCLONE]: HurricanesTyphoonIconComponent,
  [HazardEnum.LANDSCAPE_SHIFT_DEGRADATION]: OtherLandscapeShiftIconComponent,
  // [HazardEnum.NO_HAZARDS]: NoHazardsIconComponent,
  [HazardEnum.OTHERS]: OtherHazardIconComponent,
};

@Component({
  selector: 'app-hazard-icon',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet, MatTooltipModule, TranslateModule],
  templateUrl: './hazard-icon.component.html',
})
export class HazardIconComponent {
  @Input({ required: true }) hazard!: HazardEnum;
  @Input() size: string = '24';
  @Input() otherHazardDetails: string | null | undefined;

  // Inherits color by default
  @Input() color: string = 'currentColor';

  iconComponent() {
    return HAZARD_ICON_MAP[this.hazard] || OtherHazardIconComponent; // Default fallback
  }

  protected get iconInputs() {
    return {
      size: this.size,
      color: this.color,
    };
  }

  getHazardLabel(): string {
    if (this.hazard === 'OTHERS') {
      return this.otherHazardDetails || 'Other';
    }
    return 'locationCard.hazardNames.' + this.hazard;
  }
}
