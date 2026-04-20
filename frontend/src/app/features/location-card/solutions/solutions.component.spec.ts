import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SolutionsComponent } from './solutions.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { HazardEnum, SolutionCategoryEnum } from '@pac-api/client';
import { MOCK_LOCATION_DATA_WITH_SOLUTIONS, MOCK_SOLUTION_CARD } from './solutions.mock';

describe('SolutionsComponent', () => {
  let component: SolutionsComponent;
  let fixture: ComponentFixture<SolutionsComponent>;
  let dialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    const dialogSpy = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [SolutionsComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    })
      .overrideComponent(SolutionsComponent, {
        remove: { imports: [MatDialogModule] },
        add: {
          providers: [{ provide: MatDialog, useValue: dialogSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(SolutionsComponent);
    component = fixture.componentInstance;
    dialog = fixture.debugElement.injector.get(MatDialog) as jasmine.SpyObj<MatDialog>;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      locationCard: {
        govActions: {
          all: 'All',
        },
        hazardNames: {
          EXTREME_HEAT: 'Extreme Heat',
          URBAN_FLOODING: 'Urban Flooding',
        },
        solutions: {
          hazardFiltersTitle: 'Hazard Filters',
          popularSolutionsTitle: 'Popular Solutions',
          sourceDescription: 'Source',
          noSolutionsBanner: {
            title: 'Not all information was disclosed',
          },
          noSolutionsContent: {
            description: "Since we don't have hazard data",
          },
        },
      },
    });
    translateService.use('en');

    fixture.componentRef.setInput('data', MOCK_LOCATION_DATA_WITH_SOLUTIONS);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate hazard filters including "All" and excluding "OTHERS"', () => {
    fixture.componentRef.setInput('data', {
      ...MOCK_LOCATION_DATA_WITH_SOLUTIONS,
      hazards: {
        statistics: { vulnerableSectors: [] },
        hazards: [
          { hazard: { hazardType: HazardEnum.EXTREME_HEAT }, hazardRank: 1 },
          { hazard: { hazardType: HazardEnum.OTHERS }, hazardRank: 2 },
          { hazard: { hazardType: HazardEnum.URBAN_FLOODING }, hazardRank: 3 },
        ],
      },
    });
    fixture.detectChanges();

    const filters = component.hazardFilters;
    expect(filters.length).toBe(3); // null + 2 hazards (OTHERS filtered out)
    expect(component.hazardFiltersCount).toBe(2);
    expect(filters[0].type).toBeNull();
    expect(filters[1].type).toBe(HazardEnum.EXTREME_HEAT);
    expect(filters[2].type).toBe(HazardEnum.URBAN_FLOODING);
  });

  it('should filter categories based on selected hazard', () => {
    // Initially all categories with solutions should be present
    expect(component.categories.length).toBe(2);

    // Select EXTREME_HEAT (which matches MOCK_SOLUTION_CARD)
    component.selectHazard(HazardEnum.EXTREME_HEAT);
    expect(component.categories.length).toBe(1);
    expect(component.categories[0].solutions[0].solution).toBe('Test Solution');

    // Select URBAN_FLOODING (which matches Economic Solution)
    component.selectHazard(HazardEnum.URBAN_FLOODING);
    expect(component.categories.length).toBe(1);
    expect(component.categories[0].solutions[0].solution).toBe('Economic Solution');

    // Select null (All)
    component.selectHazard(null);
    expect(component.categories.length).toBe(2);
  });

  it('should open solution detail modal', () => {
    component.openSolutionDetail(MOCK_SOLUTION_CARD);
    expect(dialog.open).toHaveBeenCalled();
  });

  it('should track selected hazard correctly', () => {
    expect(component.isSelected(null)).toBeTrue();
    component.selectHazard(HazardEnum.EXTREME_HEAT);
    expect(component.isSelected(HazardEnum.EXTREME_HEAT)).toBeTrue();
    expect(component.isSelected(null)).toBeFalse();
  });

  it('should show empty state banner when no hazards are present', () => {
    fixture.componentRef.setInput('data', {
      ...MOCK_LOCATION_DATA_WITH_SOLUTIONS,
      hazards: {
        hazards: [],
      },
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.bg-cdp-red')).toBeTruthy();
    expect(compiled.textContent).toContain('Not all information was disclosed');
    expect(compiled.textContent).toContain("Since we don't have hazard data");
  });
});
