import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TranslateModule } from '@ngx-translate/core';

import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { AskCdpAiOrganizationSelectorComponent } from './ask-cdp-ai-organization-selector.component';

describe('AskCdpAiOrganizationSelectorComponent', () => {
  let fixture: ComponentFixture<AskCdpAiOrganizationSelectorComponent>;
  let component: AskCdpAiOrganizationSelectorComponent;
  let locationService: jasmine.SpyObj<LocationService>;

  const organizations: LocationSuggestion[] = [
    {
      organizationId: 3417,
      slug: '3417-new-york-city-ny-united-states-of-america',
      name: 'New York City, NY',
      country: 'United States of America',
      disclosesToCDP: true,
      isReportingLeader: true,
    },
    {
      organizationId: 3420,
      slug: '3420-city-of-london-city-united-kingdom',
      name: 'City of London (City)',
      country: 'United Kingdom',
      disclosesToCDP: true,
      isReportingLeader: true,
    },
    {
      organizationId: 3422,
      slug: '3422-greater-london-authority-united-kingdom',
      name: 'Greater London Authority',
      country: 'United Kingdom',
      disclosesToCDP: true,
      isReportingLeader: true,
    },
  ];

  beforeEach(async () => {
    locationService = jasmine.createSpyObj<LocationService>('LocationService', [
      'getAllLocationNames',
    ]);
    locationService.getAllLocationNames.and.returnValue(of(organizations));

    await TestBed.configureTestingModule({
      imports: [AskCdpAiOrganizationSelectorComponent, TranslateModule.forRoot()],
      providers: [{ provide: LocationService, useValue: locationService }],
    }).compileComponents();

    fixture = TestBed.createComponent(AskCdpAiOrganizationSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('moves the active mobile option with ArrowDown and selects it with Enter', () => {
    const selectedOrganizations: LocationSuggestion[][] = [];
    component.selectedOrganizationsChange.subscribe((selection) =>
      selectedOrganizations.push(selection),
    );

    component.togglePicker();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-organization-search"]',
    );
    input.value = 'london';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const visibleOptions = component.organizationOptions();
    expect(visibleOptions.length).toBeGreaterThan(1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();

    const options: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option"]'),
    );
    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option-checkbox"]'),
    );
    expect(component.activeOptionIndex()).toBe(1);
    expect(input.getAttribute('aria-activedescendant')).toBe('ask-ai-organization-option-1');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[1].classList.contains('bg-gray-100')).toBeTrue();
    expect(checkboxes[1].checked).toBeFalse();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(selectedOrganizations.at(-1)).toEqual([visibleOptions[1]]);
  });

  it('renders country flags for the current organization, selected organizations, and options', () => {
    component.currentDisplayName = 'Corporation of Chennai';
    component.currentCountryName = 'India';
    component.selectedOrganizations = [organizations[0]];
    component.togglePicker();
    fixture.detectChanges();

    const selectorFlags: HTMLImageElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-selector"] img'),
    );
    const optionFlags: HTMLImageElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option"] img'),
    );

    expect(selectorFlags.map((flag) => flag.src)).toEqual([
      'https://flagcdn.com/in.svg',
      'https://flagcdn.com/us.svg',
    ]);
    expect(optionFlags.map((flag) => flag.src).slice(0, 2)).toEqual([
      'https://flagcdn.com/us.svg',
      'https://flagcdn.com/gb.svg',
    ]);
  });

  it('pins selected organizations at the top of the checkbox list and toggles them off', () => {
    const selectedOrganizations: LocationSuggestion[][] = [];
    component.selectedOrganizations = [organizations[1]];
    component.selectedOrganizationsChange.subscribe((selection) =>
      selectedOrganizations.push(selection),
    );

    component.togglePicker();
    fixture.detectChanges();

    const optionLabels: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option"]'),
    );
    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option-checkbox"]'),
    );

    expect(optionLabels[0].textContent).toContain('City of London (City)');
    expect(checkboxes[0].checked).toBeTrue();

    checkboxes[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(selectedOrganizations.at(-1)).toEqual([]);
  });

  it('pins the current organization above search results as checked and removable', () => {
    let currentOrganizationCleared = false;
    component.currentOrganizationId = 35905;
    component.currentDisplayName = 'Corporation of Chennai';
    component.currentCountryName = 'India';
    component.currentOrganizationCleared.subscribe(() => {
      currentOrganizationCleared = true;
    });

    component.togglePicker();
    fixture.detectChanges();

    const optionLabels: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option"]'),
    );
    const checkboxes: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="ask-ai-organization-option-checkbox"]'),
    );

    expect(optionLabels[0].textContent).toContain('Corporation of Chennai');
    expect(checkboxes[0].checked).toBeTrue();
    expect(checkboxes[0].disabled).toBeFalse();
    expect(optionLabels[1].textContent).not.toContain('Corporation of Chennai');

    checkboxes[0].dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(currentOrganizationCleared).toBeTrue();
  });

  it('keeps arrow navigation inside the available option range', () => {
    component.togglePicker();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector(
      '[data-testid="ask-ai-organization-search"]',
    );
    input.value = 'london';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    fixture.detectChanges();
    expect(component.activeOptionIndex()).toBe(0);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(component.activeOptionIndex()).toBe(component.organizationOptions().length - 1);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    expect(component.activeOptionIndex()).toBe(component.organizationOptions().length - 1);
  });
});
