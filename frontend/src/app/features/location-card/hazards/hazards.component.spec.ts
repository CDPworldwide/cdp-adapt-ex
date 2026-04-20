import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HazardsComponent } from './hazards.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import type { LocationProfile } from '@pac-api/client';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('HazardsComponent', () => {
  let component: HazardsComponent;
  let fixture: ComponentFixture<HazardsComponent>;

  const mockLocationData: LocationProfile = {
    organizationId: 12345,
    name: 'Minas Gerais',
    countryName: 'Brazil',
    lat: -17.9302,
    lng: -43.7908,
    geometry: {
      type: 'Polygon',
      coordinates: [[[-17.9302, -43.7908]]],
    },
    isReportingLeader: true,
    disclosureYear: 2025,
    requesters: ['C40 Cities', 'WWF'],
    population: 53000000,
    hazards: {
      statistics: {
        populationExposedValue: 2400000,
        populationExposedPercentage: 11.4,
        gdpAtRiskValue: 225900000000,
        gdpAtRiskPercentage: 15.2,
        gdpAtRiskCurrencyCode: 'USD',
        vulnerableSectors: [],
      },
      hazards: [
        {
          hazard: {
            hazardType: 'EXTREME_HEAT' as any,
          },
          hazardRank: 1,
          source: 'CDP Climate Change 2023',
          description: 'Intensifying heatwaves...',
          vulnerableGroups: ['Women and girls'],
          proportionExposedRange: '11-20%',
          impact: 'Severe',
          mostExposedSectors: [],
        },
      ],
    },
    governmentActions: {
      goals: [],
      actions: [
        {
          title: 'Action 1',
          hazardsAddressed: [
            { hazardType: 'EXTREME_HEAT' as any },
            { hazardType: 'DROUGHT' as any },
          ],
        },
        {
          title: 'Action 2',
          hazardsAddressed: [{ hazardType: 'EXTREME_HEAT' as any }],
        },
      ],
      projects: [],
    },
    solutions: {
      solutions: {},
    },
  };

  beforeEach(async () => {
    // Mock google maps for the test
    (window as any).google = {
      maps: {
        LatLngBounds: class {
          isEmpty = () => false;
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [HazardsComponent, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(HazardsComponent);
    component = fixture.componentInstance;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      locationCard: {
        hazardNames: {
          EXTREME_HEAT: 'Extreme Heat',
          DROUGHT: 'Drought',
          URBAN_FLOODING: 'Urban Flooding',
        },
        hazardOverview: {
          title: 'Hazard Overview',
          source: 'Source:',
          topHazards: 'Top Hazards',
          topHazardsTooltip: 'Tooltip',
          mostExposedSectors: 'Most Exposed Sectors',
          mostExposedSectorsTooltip: 'Tooltip',
        },
        hazardDetail: {
          topNHazards: 'Top {{count}} hazards',
          hazardsDisclosedCount: '({{count}} disclosed)',
          disclosure: 'disclosure',
          requestersTitle: 'Data disclosure requested by',
          requestersTooltip: 'Tooltip text',
          unknown: 'Unknown',
          noActionsDisclosed: 'No actions disclosed',
          exploreActions: 'Explore {{count}} actions',
          hazardDataSource: 'Data source:',
          vulnerablePopTitle: 'Vulnerable populations:',
          proportionLabel: 'Proportion exposed:',
          factorsLabel: 'Factors:',
          impactLabel: 'Impact:',
          mostExposedSectors: 'Most exposed sectors:',
          factors: {
            poverty: 'Poverty',
          },
        },
        sectorNames: {
          AGRICULTURE: 'Agriculture',
        },
        hazards: {
          noHazardsBanner: {
            title: 'No hazards disclosed',
            description: 'Banner description',
          },
          noHazardsContent: {
            title: 'No disclosed hazard information',
            description: 'Content description <a class="gov-actions-link">Government actions</a>',
          },
        },
      },
    });
    translateService.use('en');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Hazard Header Calculation', () => {
    it('should show Top 3 hazards when there are 3 hazards', () => {
      const threeHazards = [
        { hazard: { hazardType: 'EXTREME_HEAT' as any } },
        { hazard: { hazardType: 'DROUGHT' as any } },
        { hazard: { hazardType: 'URBAN_FLOODING' as any } },
      ] as any;

      component.data = {
        ...mockLocationData,
        hazards: { ...mockLocationData.hazards, hazards: threeHazards },
      };
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('h2');
      const headerText = Array.from(headers)
        .map((h: any) => h.textContent)
        .find((t) => t.includes('Top 3 hazards'));
      expect(headerText).toBeTruthy();

      const spans = fixture.nativeElement.querySelectorAll('span');
      const disclosedText = Array.from(spans)
        .map((s: any) => s.textContent)
        .find((t) => t.includes('(3 disclosed)'));
      expect(disclosedText).toBeTruthy();
    });

    it('should show Top 4 hazards when there are more than 4 hazards', () => {
      const fiveHazards = [
        { hazard: { hazardType: 'H1' as any } },
        { hazard: { hazardType: 'H2' as any } },
        { hazard: { hazardType: 'H3' as any } },
        { hazard: { hazardType: 'H4' as any } },
        { hazard: { hazardType: 'H5' as any } },
      ] as any;

      component.data = {
        ...mockLocationData,
        hazards: { ...mockLocationData.hazards, hazards: fiveHazards },
      };
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('h2');
      const headerText = Array.from(headers)
        .map((h: any) => h.textContent)
        .find((t) => t.includes('Top 4 hazards'));
      expect(headerText).toBeTruthy();

      const spans = fixture.nativeElement.querySelectorAll('span');
      const disclosedText = Array.from(spans)
        .map((s: any) => s.textContent)
        .find((t) => t.includes('(5 disclosed)'));
      expect(disclosedText).toBeTruthy();
    });

    it('should not render top hazards header when there are no hazards', () => {
      component.data = {
        ...mockLocationData,
        hazards: { ...mockLocationData.hazards, hazards: [] },
      };
      fixture.detectChanges();

      const headers = fixture.nativeElement.querySelectorAll('h2');
      // "Top N hazards" header should not be present
      const hasTopN = Array.from(headers).some((h: any) => h.textContent.includes('Top 0 hazards'));
      expect(hasTopN).toBeFalse();
    });
  });

  describe('No Hazards View', () => {
    it('should show "No hazards disclosed" banner when hazards array is empty', () => {
      component.data = {
        ...mockLocationData,
        hazards: {
          ...mockLocationData.hazards!,
          hazards: [],
        },
      };
      fixture.detectChanges();

      const bannerElement = fixture.nativeElement.querySelector('.bg-cdp-red');
      expect(bannerElement).toBeTruthy();
      expect(bannerElement.textContent).toContain('No hazards disclosed');
    });

    it('should emit tabChange when "Government actions" link is clicked', () => {
      component.data = {
        ...mockLocationData,
        hazards: {
          ...mockLocationData.hazards!,
          hazards: [],
        },
      };
      fixture.detectChanges();

      spyOn(component.tabChange, 'emit');
      const actionsLink = fixture.nativeElement.querySelector('.gov-actions-link');
      actionsLink.click();

      expect(component.tabChange.emit).toHaveBeenCalledWith('actions');
    });
  });

  describe('Data Disclosure Requesters', () => {
    it('should show requesters section when requesters exist', () => {
      component.data = { ...mockLocationData };
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.px-6.pb-6.flex.flex-col');
      expect(section).toBeTruthy();
      expect(section.textContent).toContain('Data disclosure requested by');
      expect(section.textContent).toContain('C40 Cities');
      expect(section.textContent).toContain('WWF');
    });

    it('should not show requesters section when no requesters exist', () => {
      component.data = {
        ...mockLocationData,
        requesters: [],
      };
      fixture.detectChanges();

      const section = fixture.nativeElement.querySelector('.px-6.pb-6.flex.flex-col');
      expect(section).toBeNull();
    });
  });

  describe('Hazard Name Translation', () => {
    it('should render hazard names as human-readable labels', () => {
      component.data = mockLocationData;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const hazardText = compiled.textContent || '';

      // Should show translated human-readable name
      expect(hazardText).toContain('Extreme Heat');
      // Should NOT show raw enum key
      expect(hazardText).not.toContain('EXTREME_HEAT');
    });

    it('should display otherHazardDetails when hazard type is OTHERS', () => {
      const othersHazardData: LocationProfile = {
        ...mockLocationData,
        hazards: {
          ...mockLocationData.hazards,
          hazards: [
            {
              hazard: {
                hazardType: 'OTHERS' as any,
                otherHazardDetails: 'Custom climate anomaly affecting local ecosystems',
              },
              hazardRank: 1,
              source: 'Local Environmental Study',
              description: 'Unusual weather patterns...',
              vulnerableGroups: [],
              proportionExposedRange: '5-15%',
              impact: 'Moderate',
              mostExposedSectors: [],
            },
          ],
        },
      };

      component.data = othersHazardData;
      fixture.detectChanges();

      const compiled = fixture.nativeElement as HTMLElement;
      const hazardText = compiled.textContent || '';

      // Should show the custom otherHazardDetails
      expect(hazardText).toContain('Custom climate anomaly affecting local ecosystems');
      // Should NOT show a translated name
      expect(hazardText).not.toContain('OTHERS');
    });
  });

  describe('Adaptation Actions Banner', () => {
    beforeEach(() => {
      component.data = mockLocationData;
    });

    it('should return correct action count for a hazard', () => {
      const heatHazard = { hazardType: 'EXTREME_HEAT' as any };
      const droughtHazard = { hazardType: 'DROUGHT' as any };
      const floodHazard = { hazardType: 'URBAN_FLOODING' as any };

      expect(component.getActionsCountForHazard(heatHazard)).toBe(2);
      expect(component.getActionsCountForHazard(droughtHazard)).toBe(1);
      expect(component.getActionsCountForHazard(floodHazard)).toBe(0);
    });

    it('should handle "OTHERS" hazard type with details', () => {
      component.data = {
        ...mockLocationData,
        governmentActions: {
          ...mockLocationData.governmentActions,
          actions: [
            {
              title: 'Other Action',
              hazardsAddressed: [
                { hazardType: 'OTHERS' as any, otherHazardDetails: 'Special Hazard' },
              ],
            },
          ],
        },
      };

      const otherHazard = { hazardType: 'OTHERS' as any, otherHazardDetails: 'Special Hazard' };
      const differentOtherHazard = { hazardType: 'OTHERS' as any, otherHazardDetails: 'Different' };

      expect(component.getActionsCountForHazard(otherHazard)).toBe(1);
      expect(component.getActionsCountForHazard(differentOtherHazard)).toBe(0);
    });

    it('should emit exploreActions when banner is clicked', () => {
      const emitSpy = spyOn(component.exploreActions, 'emit');
      const heatHazard = mockLocationData.hazards.hazards![0].hazard;

      component.onExploreActions(heatHazard);
      expect(emitSpy).toHaveBeenCalledWith(heatHazard);
    });
  });
});
