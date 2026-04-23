import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HazardMapComponent } from '../../hazard-map/hazard-map';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { SectorIconComponent } from '../../../shared/components/sector-icon/sector-icon.component';
import { InfoIconComponent, ArrowRightIconComponent } from '../../../shared/icons';
import { ShowMoreButtonComponent } from '../../../shared/components/show-more-button/show-more-button.component';
import type { AdaptationAction, Hazard, LocationProfile } from '@pac-api/client';

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
    ShowMoreButtonComponent,
  ],
  templateUrl: './hazards.component.html',
  styleUrls: ['./hazards.component.css'],
})
export class HazardsComponent implements AfterViewInit {
  @Input() data: LocationProfile | null = null;
  @Input() jurisdictionBounds?: google.maps.LatLngBounds;

  @Output() exploreActions = new EventEmitter<Hazard>();

  @ViewChildren('dataFieldContent') dataFieldContents!: QueryList<ElementRef>;

  expandedHazards = new Set<string>();
  showAllHazards = false;
  private overflowMap = new Map<string, boolean>();

  constructor(private cdr: ChangeDetectorRef) {}

  get requesters(): string[] {
    return (this.data?.requesters ?? [])
      .flatMap((r) => r.split(',').map((s) => s.trim()))
      .filter(Boolean);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.checkOverflow());
    this.dataFieldContents.changes.subscribe(() => setTimeout(() => this.checkOverflow()));
  }

  private checkOverflow(): void {
    const hazards = this.data?.hazards?.hazards ?? [];
    const visible = this.showAllHazards ? hazards : hazards.slice(0, 4);
    this.dataFieldContents.forEach((el, i) => {
      const item = visible[i];
      if (!item) return;
      const key = this.getHazardKey(item.hazard as Hazard);
      if (!this.isHazardExpanded(item.hazard as Hazard)) {
        this.overflowMap.set(key, el.nativeElement.scrollHeight > el.nativeElement.clientHeight);
      }
    });
    this.cdr.detectChanges();
  }

  hazardOverflows(hazard: Hazard): boolean {
    return this.overflowMap.get(this.getHazardKey(hazard)) ?? false;
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
      setTimeout(() => this.checkOverflow());
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

  parseImpact(text: string): { text: string; url: string | null } {
    const normalized = text.replace(/\\n/g, '\n');
    const urlRegex = /(https?:\/\/\S+)/;
    const match = normalized.match(urlRegex);
    if (!match) return { text: normalized.trim(), url: null };
    return {
      text: normalized.slice(0, match.index).trim(),
      url: match[0],
    };
  }
}
