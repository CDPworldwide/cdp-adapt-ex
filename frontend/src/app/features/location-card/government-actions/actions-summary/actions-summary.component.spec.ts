import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActionsSummaryComponent } from './actions-summary.component';
import { HazardEnum, Hazard } from '@pac-api/client';
import type { HazardSummaryRow } from '../government-actions.types';

describe('ActionsSummaryComponent', () => {
  let component: ActionsSummaryComponent;
  let fixture: ComponentFixture<ActionsSummaryComponent>;

  const mockRows: HazardSummaryRow[] = [
    {
      hazard: { hazardType: HazardEnum.EXTREME_HEAT } as Hazard,
      goalsCount: 2,
      actionsCount: 2,
      icon: HazardEnum.EXTREME_HEAT,
    },
    {
      hazard: { hazardType: HazardEnum.DROUGHT } as Hazard,
      goalsCount: 3,
      actionsCount: 1,
      icon: HazardEnum.DROUGHT,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionsSummaryComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionsSummaryComponent);
    component = fixture.componentInstance;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      locationCard: {
        govActions: {
          actionsSummary: 'Actions summary',
          all: 'All',
          goals: 'Goals',
          actions: 'Actions',
        },
        hazardNames: {
          EXTREME_HEAT: 'Extreme Heat',
          DROUGHT: 'Drought',
        },
      },
    });
    translateService.use('en');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('filter selection', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('summaryRows', mockRows);
      fixture.componentRef.setInput('totalGoals', 5);
      fixture.componentRef.setInput('totalActions', 3);
      fixture.detectChanges();
    });

    it('should default to no filter selected (All)', () => {
      expect(component.selectedFilter).toBeNull();
      expect(component.isSelected(null)).toBeTrue();
    });

    it('should emit filterChanged when a hazard is clicked', () => {
      spyOn(component.filterChanged, 'emit');

      const key = component.hazardKey(mockRows[0]);
      component.selectFilter(key);

      expect(component.filterChanged.emit).toHaveBeenCalledWith(key);
    });

    it('should emit null when All is clicked', () => {
      spyOn(component.filterChanged, 'emit');

      component.selectFilter(null);

      expect(component.filterChanged.emit).toHaveBeenCalledWith(null);
    });

    it('should report correct selection state', () => {
      const heatKey = component.hazardKey(mockRows[0]);
      const droughtKey = component.hazardKey(mockRows[1]);

      fixture.componentRef.setInput('selectedFilter', heatKey);
      fixture.detectChanges();

      expect(component.isSelected(heatKey)).toBeTrue();
      expect(component.isSelected(droughtKey)).toBeFalse();
      expect(component.isSelected(null)).toBeFalse();
    });

    it('should generate correct hazard keys', () => {
      expect(component.hazardKey(mockRows[0])).toBe('EXTREME_HEAT|');
      expect(component.hazardKey(mockRows[1])).toBe('DROUGHT|');
    });

    it('should generate correct hazard key for OTHERS type', () => {
      const othersRow: HazardSummaryRow = {
        hazard: {
          hazardType: HazardEnum.OTHERS as any,
          otherHazardDetails: 'Volcanic activity',
        } as Hazard,
        goalsCount: 1,
        actionsCount: 0,
        icon: HazardEnum.OTHERS,
      };

      expect(component.hazardKey(othersRow)).toBe('OTHERS|Volcanic activity');
    });

    it('should show selected styling on the active filter row', () => {
      const heatKey = component.hazardKey(mockRows[0]);
      fixture.componentRef.setInput('selectedFilter', heatKey);
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const buttons = compiled.querySelectorAll('button');
      const selectedButtons = Array.from(buttons).filter((b) =>
        b.classList.contains('bg-cdp-dark'),
      );

      expect(selectedButtons.length).toBeGreaterThan(0);
    });
  });
});
