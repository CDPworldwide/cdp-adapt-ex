import {
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { LocationService } from '../../shared/services/location.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { filterLocationSuggestions } from '../../shared/services/location-search.util';
import { countryFlagImageUrl } from '../../shared/utils/country-flag.util';

@Component({
  selector: 'app-ask-cdp-ai-organization-selector',
  standalone: true,
  imports: [ReactiveFormsModule, TranslateModule],
  templateUrl: './ask-cdp-ai-organization-selector.component.html',
  styleUrl: './ask-cdp-ai-organization-selector.component.css',
})
export class AskCdpAiOrganizationSelectorComponent implements OnInit, OnChanges {
  @Input() currentOrganizationId: number | null | undefined = null;
  @Input() currentDisplayName = '';
  @Input() currentCountryName = '';
  @Input() selectedOrganizations: LocationSuggestion[] = [];
  @Output() selectedOrganizationsChange = new EventEmitter<LocationSuggestion[]>();
  @Output() currentOrganizationCleared = new EventEmitter<void>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly organizationOptions = signal<LocationSuggestion[]>([]);
  readonly activeOptionIndex = signal(0);
  isDropdownOpen = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly locationService = inject(LocationService);
  private readonly mobileKeyboardViewportService = inject(MobileKeyboardViewportService);
  private readonly translateService = inject(TranslateService);
  private allOrganizations: LocationSuggestion[] = [];
  private defaultOrganizationOptions: LocationSuggestion[] = [];
  private static readonly OPTION_LIMIT = 6;

  ngOnInit(): void {
    this.loadOrganizationOptions();
    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.updateOrganizationOptions(value));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentOrganizationId'] || changes['selectedOrganizations']) {
      if (
        this.currentOrganizationId != null &&
        this.selectedOrganizations.some(
          (organization) => organization.organizationId === this.currentOrganizationId,
        )
      ) {
        this.selectedOrganizationsChange.emit(
          this.selectedOrganizations.filter(
            (organization) => organization.organizationId !== this.currentOrganizationId,
          ),
        );
      }
      this.updateOrganizationOptions(this.searchControl.value);
    }
  }

  get displayName(): string {
    return (
      this.currentDisplayName ||
      this.selectedOrganizations[0]?.name ||
      this.translateService.instant('askCdpAi.organizationSelector.defaultDisplayName')
    );
  }

  get hasSelection(): boolean {
    return Boolean(this.currentDisplayName) || this.selectedOrganizations.length > 0;
  }

  get currentFlagImageUrl(): string {
    return this.countryFlagImageUrl(this.currentCountryName);
  }

  get currentOrganizationOption(): LocationSuggestion | null {
    if (this.currentOrganizationId == null || !this.currentDisplayName) {
      return null;
    }

    return {
      organizationId: this.currentOrganizationId,
      slug: String(this.currentOrganizationId),
      name: this.currentDisplayName,
      country: this.currentCountryName || undefined,
      disclosesToCDP: true,
      isReportingLeader: true,
    };
  }

  countryFlagImageUrl(countryName: string | null | undefined): string {
    return countryFlagImageUrl(countryName);
  }

  togglePicker(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.searchControl.setValue('');
      this.updateOrganizationOptions('');
    }
  }

  onSearchFocus(event: FocusEvent): void {
    this.isDropdownOpen = true;
    this.updateOrganizationOptions(this.searchControl.value);
    const input = event.target;
    if (input instanceof HTMLElement) {
      this.mobileKeyboardViewportService.keepElementVisible(input);
    }
  }

  onSelectorSurfaceClick(event: MouseEvent): void {
    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }

    this.isDropdownOpen = true;
    this.updateOrganizationOptions(this.searchControl.value);
  }

  onPickerFocusOut(event: FocusEvent): void {
    const pickerElement = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && pickerElement) {
      if (pickerElement.contains(nextTarget)) {
        return;
      }
    }

    setTimeout(() => {
      if (!pickerElement || pickerElement.contains(this.document.activeElement)) {
        return;
      }

      this.isDropdownOpen = false;
    });
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isDropdownOpen = false;
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      if (!this.isDropdownOpen) {
        this.isDropdownOpen = true;
        this.updateOrganizationOptions(this.searchControl.value);
      }
      this.moveActiveOption(event.key);
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    const activeOrganization = this.organizationOptions()[this.activeOptionIndex()];
    if (!activeOrganization) {
      return;
    }

    event.preventDefault();
    this.toggleOrganization(activeOrganization);
  }

  onOptionKeydown(event: KeyboardEvent, organization: LocationSuggestion): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    this.toggleOrganization(organization);
  }

  toggleOrganization(organization: LocationSuggestion): void {
    if (this.isCurrentOrganization(organization)) {
      this.currentOrganizationCleared.emit();
      return;
    }

    if (this.isSelectedOrganization(organization)) {
      this.removeOrganization(organization);
      return;
    }

    this.selectedOrganizationsChange.emit([...this.selectedOrganizations, organization]);
    this.updateOrganizationOptions(this.searchControl.value);
  }

  getOptionId(index: number): string {
    return `ask-ai-organization-option-${index}`;
  }

  get activeOptionId(): string | null {
    if (!this.isDropdownOpen || !this.organizationOptions()[this.activeOptionIndex()]) {
      return null;
    }

    return this.getOptionId(this.activeOptionIndex());
  }

  removeOrganization(organization: LocationSuggestion): void {
    this.selectedOrganizationsChange.emit(
      this.selectedOrganizations.filter(
        (selectedOrganization) =>
          selectedOrganization.organizationId !== organization.organizationId,
      ),
    );
  }

  private loadOrganizationOptions(): void {
    this.locationService
      .getAllLocationNames()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((organizations) => {
        this.allOrganizations = organizations;
        this.defaultOrganizationOptions = [...organizations]
          .map((organization) => ({
            organization,
            group: organization.isReportingLeader ? 0 : 1,
            key: organization.name,
          }))
          .sort((a, b) => a.group - b.group || a.key.localeCompare(b.key))
          .map((entry) => entry.organization);
        this.updateOrganizationOptions(this.searchControl.value);
      });
  }

  isSelectedOrganization(organization: LocationSuggestion): boolean {
    if (this.isCurrentOrganization(organization)) {
      return true;
    }

    return this.selectedOrganizations.some(
      (selectedOrganization) => selectedOrganization.organizationId === organization.organizationId,
    );
  }

  private updateOrganizationOptions(value: string): void {
    const currentOrganizationOption = this.currentOrganizationOption;
    const selectedOptions = this.selectedOrganizations.filter(
      (organization) => !this.isCurrentOrganization(organization),
    );

    const options = filterLocationSuggestions(
      value,
      this.allOrganizations,
      AskCdpAiOrganizationSelectorComponent.OPTION_LIMIT,
      this.defaultOrganizationOptions,
    ).filter(
      (organization) =>
        !this.isCurrentOrganization(organization) && !this.isSelectedOrganization(organization),
    );

    this.organizationOptions.set([
      ...(currentOrganizationOption ? [currentOrganizationOption] : []),
      ...selectedOptions,
      ...options,
    ]);
    this.activeOptionIndex.set(0);
  }

  private moveActiveOption(key: string): void {
    const optionCount = this.organizationOptions().length;
    if (!optionCount) {
      this.activeOptionIndex.set(0);
      return;
    }

    const currentIndex = Math.max(this.activeOptionIndex(), 0);
    const nextIndex =
      key === 'ArrowDown'
        ? Math.min(currentIndex + 1, optionCount - 1)
        : key === 'ArrowUp'
          ? Math.max(currentIndex - 1, 0)
          : key === 'End'
            ? optionCount - 1
            : 0;

    this.activeOptionIndex.set(nextIndex);
    this.scrollActiveOptionIntoView();
  }

  private scrollActiveOptionIntoView(): void {
    requestAnimationFrame(() => {
      this.document
        .getElementById(this.getOptionId(this.activeOptionIndex()))
        ?.scrollIntoView({ block: 'nearest' });
    });
  }

  private isCurrentOrganization(organization: LocationSuggestion): boolean {
    return organization.organizationId === this.currentOrganizationId;
  }
}
