import { Component, Input, Type } from '@angular/core';
import { CommonModule, NgComponentOutlet } from '@angular/common';
import { SectorEnum } from '@pac-api/client';
import {
  AgricultureIconComponent,
  ConservationIconComponent,
  ConstructionIconComponent,
  ElectricityGasSteamIconComponent,
  FishingIconComponent,
  ForestryIconComponent,
  ManufacturingIconComponent,
  MiningAndQuarryingIconComponent,
  WasteManagementIconComponent,
  WaterAndSewerageIconComponent,
  WholesaleRetailIconComponent,
  TransportationStorageIconComponent,
  InformationCommunicationIconComponent,
  AccommodationFoodServiceIconComponent,
  FinancialInsuranceIconComponent,
  RealEstateIconComponent,
  ProfessionalScientificTechnicalIconComponent,
  AdminSupportServicesIconComponent,
  PublicAdminDefenceIconComponent,
  EducationIconComponent,
  HumanHealthSocialWorkIconComponent,
  ArtsEntertainmentRecreationIconComponent,
  OtherSectorsIconComponent,
} from '../../icons/sectors';

const SECTOR_ICON_MAP: Record<SectorEnum, Type<any>> = {
  [SectorEnum.AGRICULTURE]: AgricultureIconComponent,
  [SectorEnum.CONSERVATION]: ConservationIconComponent,
  [SectorEnum.CONSTRUCTION]: ConstructionIconComponent,
  [SectorEnum.ELECTRICITY_GAS_STEAM_AIR]: ElectricityGasSteamIconComponent,
  [SectorEnum.FISHING]: FishingIconComponent,
  [SectorEnum.FORESTRY]: ForestryIconComponent,
  [SectorEnum.MANUFACTURING]: ManufacturingIconComponent,
  [SectorEnum.MINING_QUARRYING]: MiningAndQuarryingIconComponent,
  [SectorEnum.WASTE_MANAGEMENT]: WasteManagementIconComponent,
  [SectorEnum.WATER_SUPPLY]: WaterAndSewerageIconComponent,
  [SectorEnum.SEWERAGE_WASTE_REMEDIATION]: WaterAndSewerageIconComponent,
  [SectorEnum.WHOLESALE_RETAIL_TRADE]: WholesaleRetailIconComponent,
  [SectorEnum.TRANSPORTATION_STORAGE]: TransportationStorageIconComponent,
  [SectorEnum.INFORMATION_COMMUNICATION]: InformationCommunicationIconComponent,
  [SectorEnum.ACCOMMODATION_FOOD_SERVICE]: AccommodationFoodServiceIconComponent,
  [SectorEnum.FINANCIAL_INSURANCE]: FinancialInsuranceIconComponent,
  [SectorEnum.REAL_ESTATE]: RealEstateIconComponent,
  [SectorEnum.PROFESSIONAL_SCIENTIFIC_TECHNICAL]: ProfessionalScientificTechnicalIconComponent,
  [SectorEnum.ADMIN_SUPPORT_SERVICES]: AdminSupportServicesIconComponent,
  [SectorEnum.PUBLIC_ADMIN_DEFENCE]: PublicAdminDefenceIconComponent,
  [SectorEnum.EDUCATION]: EducationIconComponent,
  [SectorEnum.HUMAN_HEALTH_SOCIAL_WORK]: HumanHealthSocialWorkIconComponent,
  [SectorEnum.ARTS_ENTERTAINMENT_RECREATION]: ArtsEntertainmentRecreationIconComponent,
  [SectorEnum.OTHERS]: OtherSectorsIconComponent,
};

@Component({
  selector: 'app-sector-icon',
  standalone: true,
  imports: [CommonModule, NgComponentOutlet],
  templateUrl: './sector-icon.component.html',
})
export class SectorIconComponent {
  @Input({ required: true }) sector!: SectorEnum;
  @Input() otherSectorDetails?: string | null; // For "Other" sector details
  @Input() size: string | number = 24;
  @Input() color = 'currentColor';

  iconComponent(): Type<any> {
    return SECTOR_ICON_MAP[this.sector];
  }

  protected get iconInputs() {
    return {
      size: this.size,
      color: this.color,
    };
  }
}
