import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { NoHazardsIconComponent } from '../../../shared/icons';
import { EdgeCaseBannerVariant } from './edge-case-banner.util';
import { ExportTrackingService } from '../../../core/analytics/export-tracking.service';

// Disclosure edge-case banner shown atop the Hazards and Government Actions tabs.
@Component({
  selector: 'app-edge-case-banner',
  standalone: true,
  imports: [CommonModule, TranslateModule, NoHazardsIconComponent],
  templateUrl: './edge-case-banner.component.html',
})
export class EdgeCaseBannerComponent {
  @Input() variant: EdgeCaseBannerVariant = null;

  readonly openDataUrl = 'https://data.cdp.net/';

  constructor(private exportTracking: ExportTrackingService) {}

  trackOpenDataExport(): void {
    this.exportTracking.trackExternalExport({
      destination_url: this.openDataUrl,
      export_type: 'location_open_data',
      source: 'edge_case_no_hazards_banner',
    });
  }
}
