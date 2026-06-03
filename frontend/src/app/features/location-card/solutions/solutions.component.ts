import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import {
  ArrowRightLongIconComponent,
  InfoIconComponent,
  NoHazardsIconComponent,
} from '../../../shared/icons';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { HazardEnum, LocationProfile, SolutionCard, SolutionCategoryEnum } from '@pac-api/client';
import { SolutionDetailModalComponent } from './solution-detail-modal.component';
import { ProtectedTranslationHtmlPipe } from '../../../shared/pipes/protected-translation-html.pipe';

@Component({
  selector: 'app-solutions',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    ArrowRightLongIconComponent,
    InfoIconComponent,
    NoHazardsIconComponent,
    MatTooltipModule,
    MatDialogModule,
    RouterLink,
    ProtectedTranslationHtmlPipe,
  ],
  templateUrl: './solutions.component.html',
})
export class SolutionsComponent {
  @Input() data: LocationProfile | null = null;

  private dialog = inject(MatDialog);
  private breakpointObserver = inject(BreakpointObserver);

  selectedHazard: HazardEnum | null = null;

  constructor() {}

  /**
   * Which "action ideas are CDP-analysis-derived" flag to show, or null for a
   * normal full discloser (whose action ideas come from their own disclosed
   * hazards). The variant key also selects the explanatory sentence:
   *   - 'limited'      → disclosed but not enough usable hazards ({1.a}/{1.b})
   *   - 'private'      → Non-Public discloser ({1.c})
   *   - 'nonDiscloser' → never disclosed to CDP ({2})
   */
  get analysisFlagVariant(): 'limited' | 'private' | 'nonDiscloser' | null {
    if (!this.data) return null;
    const status = this.data.publicStatus;
    if (status == null || status === 'GEE-Derived') return 'nonDiscloser';
    if (status === 'Non-Public') return 'private';
    if (status === 'Public') {
      const disclosed = (this.data.hazards?.hazards ?? []).filter(
        (h) => h.source !== 'GEE-Derived',
      );
      // No usable disclosed hazards (none at all, or all free-text 'Other:').
      const limited =
        disclosed.length === 0 ||
        disclosed.every((h) => h.hazard?.hazardType === HazardEnum.OTHERS);
      return limited ? 'limited' : null;
    }
    return null;
  }

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
