import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslateModule } from '@ngx-translate/core';
import { ActionStatus, ActionStatusEnum } from '@pac-api/client';
import type {
  ActionsTab,
  AdaptationAction,
  AdaptationGoal,
  Hazard,
  ProjectSeekingFunding,
} from '@pac-api/client';

import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import { NoHazardsIconComponent } from '../../../shared/icons';
import { AdaptationActionDetailComponent } from './adaptation-action-detail/adaptation-action-detail.component';
import { AdaptationGoalDetailComponent } from './adaptation-goal-detail/adaptation-goal-detail.component';
import { ProjectSeekingFundingDetailComponent } from './project-seeking-funding-detail/project-seeking-funding-detail.component';
import { ActionsSummaryComponent } from './actions-summary/actions-summary.component';
import { AutoTranslatePipe } from '../../../shared/pipes/auto-translate.pipe';
import { splitTitleAtLastColon } from '../../../shared/utils/title.util';
import type { HazardSummaryRow, DetailItemType } from './government-actions.types';

export type { HazardSummaryRow, DetailItemType };

@Component({
  selector: 'app-government-actions',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    HazardIconComponent,
    NoHazardsIconComponent,
    AdaptationActionDetailComponent,
    AdaptationGoalDetailComponent,
    ProjectSeekingFundingDetailComponent,
    ActionsSummaryComponent,
    AutoTranslatePipe,
    A11yModule,
  ],
  templateUrl: './government-actions.component.html',
  styleUrls: ['./government-actions.component.css'],
})
export class GovernmentActionsComponent implements OnChanges {
  @Input() data: ActionsTab | null = null;
  @Input() locationName: string = '';
  @Input() countryName: string = '';
  @Input() disclosureYear: number | null | undefined;
  @Input() selectedFilter: string | null = null;

  summaryRows: HazardSummaryRow[] = [];
  totalGoals: number = 0;
  totalActions: number = 0;
  totalProjects: number = 0;
  filteredGoals: AdaptationGoal[] = [];
  filteredActions: AdaptationAction[] = [];
  filteredProjects: ProjectSeekingFunding[] = [];

  get isAllEmpty(): boolean {
    return this.totalGoals === 0 && this.totalActions === 0 && this.totalProjects === 0;
  }

  get isAnyEmpty(): boolean {
    return this.totalGoals === 0 || this.totalActions === 0 || this.totalProjects === 0;
  }
  selectedType: DetailItemType | null = null;
  selectedItem: AdaptationGoal | AdaptationAction | ProjectSeekingFunding | null = null;
  private previousFocus: HTMLElement | null = null;

  get selectedAction(): AdaptationAction {
    return this.selectedItem as AdaptationAction;
  }

  get selectedGoal(): AdaptationGoal {
    return this.selectedItem as AdaptationGoal;
  }

  get selectedProject(): ProjectSeekingFunding {
    return this.selectedItem as ProjectSeekingFunding;
  }

  formatFinanceModel(model: string | string[] | undefined | null): string {
    if (!model) return '';
    return Array.isArray(model) ? model.join(', ') : (model as string);
  }

  splitTitleAtLastColon = splitTitleAtLastColon;

  ngOnChanges(changes: SimpleChanges): void {
    const dataChanged = !!changes['data'] && !!this.data;
    const filterChanged = !!changes['selectedFilter'];

    if (dataChanged && !filterChanged) {
      this.selectedFilter = null;
    }

    if (dataChanged || filterChanged) {
      this.calculateSummary();
    }
  }

  private calculateSummary(): void {
    if (!this.data) return;

    const summaryMap = new Map<string, HazardSummaryRow>();

    const getHazardKey = (hazard: Hazard): string =>
      `${hazard.hazardType}|${hazard.otherHazardDetails || ''}`;

    const getRow = (hazard: Hazard): HazardSummaryRow => {
      const key = getHazardKey(hazard);
      if (!summaryMap.has(key)) {
        summaryMap.set(key, { hazard, goalsCount: 0, actionsCount: 0, icon: hazard.hazardType });
      }
      return summaryMap.get(key)!;
    };

    this.data.goals?.forEach((goal: AdaptationGoal) => {
      goal.hazardsAddressed?.forEach((hazard: Hazard) => getRow(hazard).goalsCount++);
    });

    this.data.actions?.forEach((action: AdaptationAction) => {
      action.hazardsAddressed?.forEach((hazard: Hazard) => getRow(hazard).actionsCount++);
    });

    this.summaryRows = Array.from(summaryMap.values());
    this.totalGoals = this.data.goals?.length || 0;
    this.totalActions = this.data.actions?.length || 0;
    this.totalProjects = this.data.projects?.length || 0;
    this.applyFilter();
  }

  onFilterChanged(hazardKey: string | null): void {
    this.selectedFilter = hazardKey;
    this.applyFilter();
  }

  private applyFilter(): void {
    if (!this.data) return;

    if (!this.selectedFilter) {
      this.filteredGoals = this.data.goals || [];
      this.filteredActions = this.data.actions || [];
      this.filteredProjects = this.data.projects || [];
      return;
    }

    const [hazardType, otherDetails] = this.selectedFilter.split('|');
    const matches = (hazards?: Hazard[]) =>
      hazards?.some(
        (h: Hazard) => h.hazardType === hazardType && (h.otherHazardDetails || '') === otherDetails,
      ) ?? false;

    this.filteredGoals = (this.data.goals || []).filter((g: AdaptationGoal) =>
      matches(g.hazardsAddressed),
    );
    this.filteredActions = (this.data.actions || []).filter((a: AdaptationAction) =>
      matches(a.hazardsAddressed),
    );
    this.filteredProjects = this.data.projects || [];
  }

  selectItem(
    type: DetailItemType,
    item: AdaptationGoal | AdaptationAction | ProjectSeekingFunding,
  ): void {
    this.previousFocus = document.activeElement as HTMLElement;
    this.selectedType = type;
    this.selectedItem = item;
  }

  closeDetail(): void {
    this.selectedType = null;
    this.selectedItem = null;
    setTimeout(() => this.previousFocus?.focus());
  }

  // TODO: Differentiate between status for adaptation action and status for project seeking funding.
  getStatusClass(status: ActionStatus | null | undefined): string {
    if (!status) {
      return 'bg-gray-400 text-white';
    }

    const s = status.statusType;

    switch (true) {
      case s === ActionStatusEnum.SCOPING:
      case s === ActionStatusEnum.PRE_FEASIBILITY_STUDY:
      case s.startsWith('FEASIBILITY'):
        return 'bg-gray-400 text-white';

      case s.startsWith('IMPLEMENTATION'):
        return 'bg-green-500 text-white';

      case s.startsWith('ACTION_IN_OPERATION'):
        return 'bg-blue-400 text-white';

      default:
        return 'bg-gray-400 text-white';
    }
  }
}
