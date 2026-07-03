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
      name: 'New York City, NY',
      country: 'United States of America',
      disclosesToCDP: true,
      isReportingLeader: true,
    },
    {
      organizationId: 3420,
      name: 'City of London (City)',
      country: 'United Kingdom',
      disclosesToCDP: true,
      isReportingLeader: true,
    },
    {
      organizationId: 3422,
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
    expect(component.activeOptionIndex()).toBe(1);
    expect(input.getAttribute('aria-activedescendant')).toBe('ask-ai-organization-option-1');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[1].classList.contains('bg-gray-100')).toBeTrue();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(selectedOrganizations.at(-1)).toEqual([visibleOptions[1]]);
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
