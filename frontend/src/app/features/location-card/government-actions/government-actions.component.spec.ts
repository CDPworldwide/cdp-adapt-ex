import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { GovernmentActionsComponent } from './government-actions.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActionsTab, ActionStatusEnum, Hazard, HazardEnum } from '@pac-api/client';

describe('GovernmentActionsComponent', () => {
  let component: GovernmentActionsComponent;
  let fixture: ComponentFixture<GovernmentActionsComponent>;

  const mockDataWithNoActions: ActionsTab = {
    goals: [
      {
        title: 'Goal 1',
        hazardsAddressed: [
          { hazardType: HazardEnum.EXTREME_HEAT } as Hazard,
          { hazardType: HazardEnum.DROUGHT } as Hazard,
        ],
        targetYear: 2025,
      },
    ],
    actions: [],
    projects: [],
  };

  const mockDataWithGoalsAndActions: ActionsTab = {
    goals: [
      {
        title: 'Goal 1',
        hazardsAddressed: [
          { hazardType: HazardEnum.EXTREME_HEAT } as Hazard,
          { hazardType: HazardEnum.DROUGHT } as Hazard,
        ],
        targetYear: 2025,
      },
    ],
    actions: [
      {
        title: 'Action 1',
        status: {
          statusType: ActionStatusEnum.IMPLEMENTATION_COMPLETE_REPORTING_YEAR,
        },
        coBenefits: ['Co-benefit 1'],
        hazardsAddressed: [{ hazardType: HazardEnum.EXTREME_HEAT } as Hazard],
      },
      {
        title: 'Action 2',
        status: {
          statusType: ActionStatusEnum.IMPLEMENTATION_COMPLETE_REPORTING_YEAR,
        },
        coBenefits: ['Co-benefit 2'],
        hazardsAddressed: [
          { hazardType: HazardEnum.EXTREME_HEAT } as Hazard,
          { hazardType: HazardEnum.DROUGHT } as Hazard,
        ],
      },
    ],
    projects: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GovernmentActionsComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(GovernmentActionsComponent);
    component = fixture.componentInstance;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      locationCard: {
        hazardNames: {
          EXTREME_HEAT: 'Extreme Heat',
          DROUGHT: 'Drought',
        },
        govActions: {
          adaptationGoals: 'Adaptation goals ({{count}} disclosed)',
          adaptationGoalsTitle: 'Adaptation goals',
          adaptationActions: 'Adaptation actions ({{count}} disclosed)',
          adaptationActionsTitle: 'Adaptation actions',
          projectsSeekingFundingWithCount: 'Projects seeking funding ({{count}} disclosed)',
          projectsSeekingFundingTitle: 'Projects seeking funding',
          projectSeekingFunding: 'Project seeking funding',
          disclosedCount: '({{count}} disclosed)',
          filterByHazard: 'Filter by hazard',
          all: 'All',
          noGoals: {
            description: 'No goals description',
          },
          noActions: {
            description: 'No actions description',
          },
          noProjects: {
            description: 'No projects description',
          },
        },
      },
    });
    translateService.use('en');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show empty-state descriptions when everything is empty', () => {
    fixture.componentRef.setInput('data', { goals: [], actions: [], projects: [] });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No goals description');
    expect(compiled.textContent).toContain('No actions description');
    expect(compiled.textContent).toContain('No projects description');
  });

  it('should show the relevant empty-state description when only one section is empty', () => {
    fixture.componentRef.setInput('data', {
      goals: [{ title: 'Goal 1', hazardsAddressed: [] }],
      actions: [{ title: 'Action 1', hazardsAddressed: [] }],
      projects: [],
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No projects description');
  });

  it('should show (0) in subheaders when actions are empty', () => {
    fixture.componentRef.setInput('data', mockDataWithNoActions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const headers = compiled.querySelectorAll('h2');

    // Goals header — mobile span shows count
    expect(headers[1].textContent).toContain('1');
    // Actions header — mobile span shows count
    expect(headers[2].textContent).toContain('0');
  });

  it('should apply selectedFilter when provided as an input', () => {
    fixture.componentRef.setInput('data', mockDataWithGoalsAndActions);
    fixture.componentRef.setInput('selectedFilter', 'EXTREME_HEAT|');
    fixture.detectChanges();

    // Trigger ngOnChanges manually if needed (fixture.detectChanges() should handle it for inputs)
    component.ngOnChanges({
      selectedFilter: {
        currentValue: 'EXTREME_HEAT|',
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(component.selectedFilter).toBe('EXTREME_HEAT|');
    expect(component.filteredActions.length).toBe(2);
    expect(component.filteredGoals.length).toBe(1);

    fixture.componentRef.setInput('selectedFilter', 'DROUGHT|');
    component.ngOnChanges({
      selectedFilter: {
        currentValue: 'DROUGHT|',
        previousValue: 'EXTREME_HEAT|',
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.filteredActions.length).toBe(1);
    expect(component.filteredGoals.length).toBe(1);
  });

  it('should aggregate summary data correctly', () => {
    fixture.componentRef.setInput('data', mockDataWithGoalsAndActions);
    fixture.detectChanges();

    expect(component.summaryRows.length).toBe(2);

    const heatRow = component.summaryRows.find((r) => r.hazard.hazardType === 'EXTREME_HEAT');
    expect(heatRow?.goalsCount).toBe(1);
    expect(heatRow?.actionsCount).toBe(2);
    expect(heatRow?.icon).toBe('EXTREME_HEAT');

    const droughtRow = component.summaryRows.find((r) => r.hazard.hazardType === 'DROUGHT');
    expect(droughtRow?.goalsCount).toBe(1);
    expect(droughtRow?.actionsCount).toBe(1);
    expect(droughtRow?.icon).toBe('DROUGHT');
  });

  it('should render hazard summary names as human-readable labels', () => {
    fixture.componentRef.setInput('data', mockDataWithGoalsAndActions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const summaryText = compiled.querySelector('app-actions-summary')?.textContent || '';

    expect(summaryText).toContain('Extreme Heat');
    expect(summaryText).toContain('Drought');
    expect(summaryText).not.toContain('EXTREME_HEAT');
  });

  it('should render multiple actions when data is provided', () => {
    fixture.componentRef.setInput('data', mockDataWithGoalsAndActions);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    const actionCards = compiled.querySelectorAll('[data-testid="action-card"]');
    expect(actionCards.length).toBe(2);
  });

  it('should handle location with no goals, actions and projects gracefully', () => {
    const dataWithUndefined: any = {
      goals: undefined,
      actions: undefined,
      projects: undefined,
    };
    fixture.componentRef.setInput('data', dataWithUndefined);
    fixture.detectChanges();
    expect(component.summaryRows.length).toBe(0);
  });

  describe('OTHERS Hazard Type', () => {
    it('should display otherHazardDetails for OTHERS hazard type', () => {
      const dataWithOthersHazard: ActionsTab = {
        goals: [
          {
            title: 'Goal with custom hazard',
            hazardsAddressed: [
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Unusual volcanic activity',
              } as Hazard,
            ],
            targetYear: 2025,
          },
        ],
        actions: [],
        projects: [],
      };

      fixture.componentRef.setInput('data', dataWithOthersHazard);
      fixture.detectChanges();

      expect(component.summaryRows.length).toBe(1);
      const othersRow = component.summaryRows[0];
      expect(othersRow.hazard.hazardType).toBe('OTHERS');
      expect(othersRow.hazard.otherHazardDetails).toBe('Unusual volcanic activity');
      expect(othersRow.goalsCount).toBe(1);
    });

    it('should render otherHazardDetails in the summary table', () => {
      const dataWithOthersHazard: ActionsTab = {
        goals: [
          {
            title: 'Goal with custom hazard',
            hazardsAddressed: [
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Unusual volcanic activity',
              } as Hazard,
            ],
            targetYear: 2025,
          },
        ],
        actions: [],
        projects: [],
      };

      fixture.componentRef.setInput('data', dataWithOthersHazard);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const summaryText = compiled.querySelector('app-actions-summary')?.textContent || '';

      // Should show the custom otherHazardDetails (title-cased)
      expect(summaryText).toContain('Unusual Volcanic Activity');
      // Should NOT show OTHERS as a translation key
      expect(summaryText).not.toContain('OTHERS');
    });

    it('should distinguish between different OTHERS hazards with different otherHazardDetails', () => {
      const dataWithMultipleOthers: ActionsTab = {
        goals: [
          {
            title: 'Multi-hazard goal',
            hazardsAddressed: [
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Volcanic activity',
              } as Hazard,
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Extraterrestrial impact risk',
              } as Hazard,
            ],
            targetYear: 2025,
          },
        ],
        actions: [],
        projects: [],
      };

      fixture.componentRef.setInput('data', dataWithMultipleOthers);
      fixture.detectChanges();

      // Should have 2 separate rows for the two different OTHERS hazards
      expect(component.summaryRows.length).toBe(2);

      const volcanoRow = component.summaryRows.find(
        (r) => r.hazard.otherHazardDetails === 'Volcanic activity',
      );
      const impactRow = component.summaryRows.find(
        (r) => r.hazard.otherHazardDetails === 'Extraterrestrial impact risk',
      );

      expect(volcanoRow).toBeDefined();
      expect(impactRow).toBeDefined();
      expect(volcanoRow?.goalsCount).toBe(1);
      expect(impactRow?.goalsCount).toBe(1);
    });

    it('should aggregate OTHERS hazards with same otherHazardDetails', () => {
      const dataWithRepeatedOthers: ActionsTab = {
        goals: [
          {
            title: 'Goal 1',
            hazardsAddressed: [
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Unique local threat',
              } as Hazard,
            ],
            targetYear: 2025,
          },
        ],
        actions: [
          {
            title: 'Action 1',
            status: {
              statusType: ActionStatusEnum.IMPLEMENTATION_COMPLETE_REPORTING_YEAR,
            },
            coBenefits: [],
            hazardsAddressed: [
              {
                hazardType: HazardEnum.OTHERS as any,
                otherHazardDetails: 'Unique local threat',
              } as Hazard,
            ],
          },
        ],
        projects: [],
      };

      fixture.componentRef.setInput('data', dataWithRepeatedOthers);
      fixture.detectChanges();

      // Should have only 1 row since both goal and action address the same OTHERS hazard
      expect(component.summaryRows.length).toBe(1);
      const row = component.summaryRows[0];
      expect(row.goalsCount).toBe(1);
      expect(row.actionsCount).toBe(1);
    });
  });

  describe('getStatusClass', () => {
    it('should return grey for scoping and feasibility statuses', () => {
      const scopingStatus = { statusType: ActionStatusEnum.SCOPING } as any;
      const preFeasibilityStatus = {
        statusType: ActionStatusEnum.PRE_FEASIBILITY_STUDY,
      } as any;
      const feasibilityStatus = {
        statusType: ActionStatusEnum.FEASIBILITY_FINALIZED_FULL_FINANCE,
      } as any;

      expect(component.getStatusClass(scopingStatus)).toContain('bg-gray-400');
      expect(component.getStatusClass(preFeasibilityStatus)).toContain('bg-gray-400');
      expect(component.getStatusClass(feasibilityStatus)).toContain('bg-gray-400');
    });

    it('should return green for implementation statuses', () => {
      const implementationStatus = {
        statusType: ActionStatusEnum.IMPLEMENTATION_COMPLETE_REPORTING_YEAR,
      } as any;
      expect(component.getStatusClass(implementationStatus)).toContain('bg-green-500');
    });

    it('should return blue for action in operation statuses', () => {
      const operationStatus = {
        statusType: ActionStatusEnum.ACTION_IN_OPERATION_JURISDICTION_WIDE,
      } as any;
      expect(component.getStatusClass(operationStatus)).toContain('bg-blue-400');
    });

    it('should return grey for null or other statuses', () => {
      const otherStatus = { statusType: ActionStatusEnum.OTHERS } as any;
      expect(component.getStatusClass(null as any)).toContain('bg-gray-400');
      expect(component.getStatusClass(otherStatus)).toContain('bg-gray-400');
    });
  });

  describe('hazard filtering', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('data', mockDataWithGoalsAndActions);
      fixture.detectChanges();
    });

    it('should show all goals and actions when no filter is selected', () => {
      expect(component.selectedFilter).toBeNull();
      expect(component.filteredGoals.length).toBe(1);
      expect(component.filteredActions.length).toBe(2);
    });

    it('should filter goals and actions by hazard', () => {
      component.onFilterChanged('DROUGHT|');
      fixture.detectChanges();

      expect(component.selectedFilter).toBe('DROUGHT|');
      expect(component.filteredGoals.length).toBe(1);
      expect(component.filteredActions.length).toBe(1);
    });

    it('should show only matching actions for a specific hazard', () => {
      component.onFilterChanged('EXTREME_HEAT|');
      fixture.detectChanges();

      expect(component.filteredGoals.length).toBe(1);
      expect(component.filteredActions.length).toBe(2);
    });

    it('should reset filter when All is selected', () => {
      component.onFilterChanged('DROUGHT|');
      fixture.detectChanges();
      expect(component.filteredActions.length).toBe(1);

      component.onFilterChanged(null);
      fixture.detectChanges();
      expect(component.filteredGoals.length).toBe(1);
      expect(component.filteredActions.length).toBe(2);
    });

    it('should return empty arrays when filter matches no items', () => {
      component.onFilterChanged('NONEXISTENT|');
      fixture.detectChanges();

      expect(component.filteredGoals.length).toBe(0);
      expect(component.filteredActions.length).toBe(0);
    });

    it('should update section counts in the template when filtered', () => {
      component.onFilterChanged('DROUGHT|');
      fixture.detectChanges();

      const renderedText = (fixture.nativeElement as HTMLElement).textContent ?? '';
      // Filtered counts should appear in the rendered section headers
      expect(renderedText).toContain('1 disclosed');
      expect(renderedText).toContain('0 disclosed');
    });

    it('should reset filter when data changes', () => {
      component.onFilterChanged('DROUGHT|');
      fixture.detectChanges();
      expect(component.selectedFilter).toBe('DROUGHT|');

      fixture.componentRef.setInput('data', mockDataWithNoActions);
      fixture.detectChanges();
      expect(component.selectedFilter).toBeNull();
    });
  });
});
