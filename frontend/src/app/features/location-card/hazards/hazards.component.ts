import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HazardMapComponent } from '../../hazard-map/hazard-map';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { SectorIconComponent } from '../../../shared/components/sector-icon/sector-icon.component';
import {
  InfoIconComponent,
  ArrowRightIconComponent,
  NoHazardsIconComponent,
} from '../../../shared/icons';
import { ShowMoreButtonComponent } from '../../../shared/components/show-more-button/show-more-button.component';
import { AutoTranslatePipe } from '../../../shared/pipes/auto-translate.pipe';
import type { AdaptationAction, Hazard, LocationProfile } from '@pac-api/client';
import type { LocationCardTabKey } from '../location-card-tabs';

@Component({
  selector: 'app-hazards',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatTooltipModule,
    HazardMapComponent,
    HazardIconComponent,
    SectorIconComponent,
    InfoIconComponent,
    ArrowRightIconComponent,
    NoHazardsIconComponent,
    ShowMoreButtonComponent,
    AutoTranslatePipe,
  ],
  templateUrl: './hazards.component.html',
  styleUrls: ['./hazards.component.css'],
})
export class HazardsComponent {
  @Input() data: LocationProfile | null = null;
  @Input() jurisdictionBounds?: google.maps.LatLngBounds;

  @Output() exploreActions = new EventEmitter<Hazard>();
  @Output() tabChange = new EventEmitter<LocationCardTabKey>();

  expandedHazards = new Set<string>();
  showAllHazards = false;

  onDescriptionClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.classList.contains('gov-actions-link')) {
      this.tabChange.emit('actions');
    }
  }

  getActionsCountForHazard(hazard: Hazard): number {
    if (!this.data?.governmentActions?.actions) return 0;

    return this.data.governmentActions.actions.filter(
      (action: AdaptationAction) =>
        action.hazardsAddressed?.some(
          (h: Hazard) =>
            h.hazardType === hazard.hazardType &&
            (h.otherHazardDetails || '') === (hazard.otherHazardDetails || ''),
        ),
    ).length;
  }

  isHazardExpanded(hazard: Hazard): boolean {
    return this.expandedHazards.has(this.getHazardKey(hazard));
  }

  toggleHazard(hazard: Hazard): void {
    const key = this.getHazardKey(hazard);
    if (this.expandedHazards.has(key)) {
      this.expandedHazards.delete(key);
    } else {
      this.expandedHazards.add(key);
    }
  }

  private getHazardKey(hazard: Hazard): string {
    return `${hazard.hazardType}|${hazard.otherHazardDetails || ''}`;
  }

  onExploreActions(hazard: Hazard): void {
    this.exploreActions.emit(hazard);
  }
}
