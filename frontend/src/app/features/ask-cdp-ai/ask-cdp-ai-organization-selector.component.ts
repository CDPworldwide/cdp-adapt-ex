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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { LocationService } from '../../shared/services/location.service';
import { LocationSuggestion } from '../../shared/services/location-suggestion';
import { filterLocationSuggestions } from '../../shared/services/location-search.util';

@Component({
  selector: 'app-ask-cdp-ai-organization-selector',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './ask-cdp-ai-organization-selector.component.html',
})
export class AskCdpAiOrganizationSelectorComponent implements OnInit, OnChanges {
  @Input() currentOrganizationId: number | null | undefined = null;
  @Input() currentDisplayName = '';
  @Input() selectedOrganization: LocationSuggestion | null = null;
  @Output() selectedOrganizationChange = new EventEmitter<LocationSuggestion | null>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly organizationOptions = signal<LocationSuggestion[]>([]);
  isDropdownOpen = false;

  private readonly destroyRef = inject(DestroyRef);
  private readonly locationService = inject(LocationService);
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
    if (changes['currentOrganizationId'] || changes['selectedOrganization']) {
      if (this.selectedOrganization?.organizationId === this.currentOrganizationId) {
        this.selectedOrganizationChange.emit(null);
      }
      this.updateOrganizationOptions(this.searchControl.value);
    }
  }

  get displayName(): string {
    return this.selectedOrganization?.name || this.currentDisplayName;
  }

  togglePicker(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.searchControl.setValue('');
      this.updateOrganizationOptions('');
    }
  }

  onSearchFocus(): void {
    this.isDropdownOpen = true;
    this.updateOrganizationOptions(this.searchControl.value);
  }

  onPickerFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget instanceof HTMLElement) {
      if (event.currentTarget.contains(nextTarget)) {
        return;
      }
    }

    this.isDropdownOpen = false;
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.isDropdownOpen = false;
      return;
    }

    if (event.key !== 'Enter') {
      return;
    }

    const selectedOrganization = this.organizationOptions()[0];
    if (!selectedOrganization) {
      return;
    }

    event.preventDefault();
    this.selectOrganization(selectedOrganization);
  }

  selectOrganization(organization: LocationSuggestion): void {
    if (this.isCurrentOrganization(organization) || this.isSelectedOrganization(organization)) {
      return;
    }

    this.selectedOrganizationChange.emit(organization);
    this.searchControl.setValue('');
    this.isDropdownOpen = false;
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

  private updateOrganizationOptions(value: string): void {
    const options = filterLocationSuggestions(
      value,
      this.allOrganizations,
      AskCdpAiOrganizationSelectorComponent.OPTION_LIMIT,
      this.defaultOrganizationOptions,
    ).filter(
      (organization) =>
        !this.isCurrentOrganization(organization) && !this.isSelectedOrganization(organization),
    );

    this.organizationOptions.set(options);
  }

  private isCurrentOrganization(organization: LocationSuggestion): boolean {
    return organization.organizationId === this.currentOrganizationId;
  }

  private isSelectedOrganization(organization: LocationSuggestion): boolean {
    return organization.organizationId === this.selectedOrganization?.organizationId;
  }
}
