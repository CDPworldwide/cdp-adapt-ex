import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { InfoIconComponent, ArrowRightIconComponent } from '../../../shared/icons';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  HazardEnum,
  LocationProfile,
  SolutionCardOutput,
  SolutionCategoryEnum,
} from '@pac-api/client';
import { SolutionDetailModalComponent } from './solution-detail-modal.component';
import { AutoTranslatePipe } from '../../../shared/pipes/auto-translate.pipe';

@Component({
  selector: 'app-solutions',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    InfoIconComponent,
    ArrowRightIconComponent,
    MatTooltipModule,
    MatDialogModule,
    AutoTranslatePipe,
  ],
  templateUrl: './solutions.component.html',
})
export class SolutionsComponent {
  @Input() data: LocationProfile | null = null;

  private dialog = inject(MatDialog);
  private breakpointObserver = inject(BreakpointObserver);

  selectedHazard: HazardEnum | null = null;

  constructor() {}

  get hazardFilters() {
    return [
      { type: null },
      ...(this.data?.hazards?.hazards || [])
        .slice(0, 4)
        .filter((h) => h.hazard.hazardType !== HazardEnum.OTHERS)
        .map((h) => ({
          type: h.hazard.hazardType,
        })),
    ];
  }

  get hazardFiltersCount() {
    return this.hazardFilters.length - 1; // Exclude 'All'
  }

  get categories() {
    if (!this.data?.solutions?.solutions) return [];

    // Group solutions into their respective categories and remove empty ones
    return Object.entries(this.data.solutions.solutions)
      .map(([category, solutions]: [string, SolutionCardOutput[] | undefined]) => {
        const filteredSolutions = (solutions || []).filter(
          (s: SolutionCardOutput) =>
            !this.selectedHazard ||
            s.solutionHazardsAddressed?.some((h) => h.hazardType === this.selectedHazard),
        );
        return {
          category: category as SolutionCategoryEnum,
          solutions: filteredSolutions,
        };
      })
      .filter((cat) => cat.solutions.length > 0);
  }

  selectHazard(hazardType: HazardEnum | null): void {
    this.selectedHazard = hazardType;
  }

  isSelected(hazardType: HazardEnum | null): boolean {
    return this.selectedHazard === hazardType;
  }

  openSolutionDetail(solution: SolutionCardOutput): void {
    const isMobile =
      this.breakpointObserver.isMatched(Breakpoints.Handset) ||
      this.breakpointObserver.isMatched('(max-width: 1023px)');

    this.dialog.open(SolutionDetailModalComponent, {
      data: {
        solution: solution,
        location: this.data,
      },
      width: isMobile ? '100%' : '75rem',
      height: isMobile ? '100%' : 'auto',
      maxWidth: '100vw',
      maxHeight: '100vh',
      position: isMobile ? { top: '0', left: '0' } : undefined,
      panelClass: ['solution-detail-dialog', 'm-0', 'p-0', 'lg:rounded-2xl'],
    });
  }
}
