import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { ArrowRightLongIconComponent, InfoIconComponent } from '../../../shared/icons';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { HazardEnum, LocationProfile, SolutionCard, SolutionCategoryEnum } from '@pac-api/client';
import { SolutionDetailModalComponent } from './solution-detail-modal.component';

@Component({
  selector: 'app-solutions',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    ArrowRightLongIconComponent,
    InfoIconComponent,
    MatTooltipModule,
    MatDialogModule,
    RouterLink,
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

  get categories() {
    if (!this.data?.solutions?.solutions) return [];

    // Group solutions into their respective categories and remove empty ones
    return Object.entries(this.data.solutions.solutions)
      .map(([category, solutions]: [string, SolutionCard[] | undefined]) => {
        const filteredSolutions = (solutions || []).filter(
          (s: SolutionCard) =>
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

  private readonly solutionImages = [
    'assets/images/solutions.component.images/environmental_bkgs_dew.webp',
    'assets/images/solutions.component.images/environmental_bkgs_trees.webp',
    'assets/images/solutions.component.images/environmental_bkgs_windmill.webp',
    'assets/images/solutions.component.images/environmental_bkgs_pool.webp',
    'assets/images/solutions.component.images/environmental_bkgs_water_recycling.webp',
  ];

  getCardBackground(index: number): string {
    const img = this.solutionImages[index % this.solutionImages.length];
    return `linear-gradient(180deg, rgba(30, 30, 30, 0.20) 33.22%, rgba(30, 30, 30, 0.30) 70.4%), url('${img}') lightgray 20% / cover no-repeat`;
  }

  openSolutionDetail(solution: SolutionCard): void {
    const isMobile =
      this.breakpointObserver.isMatched(Breakpoints.Handset) ||
      this.breakpointObserver.isMatched('(max-width: 1023px)');

    this.dialog.open(SolutionDetailModalComponent, {
      data: {
        solution: solution,
        location: this.data,
      },
      width: isMobile ? '100%' : '80vw',
      height: isMobile ? '100%' : '80vh',
      maxWidth: '100vw',
      maxHeight: '100vh',
      position: isMobile ? { top: '0', left: '0' } : undefined,
      panelClass: ['solution-detail-dialog', 'm-0', 'p-0'],
    });
  }
}
