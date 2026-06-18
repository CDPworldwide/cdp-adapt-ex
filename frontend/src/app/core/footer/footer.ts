import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdpLogoWithTextIconComponent } from '../../shared/icons';
import { TranslateModule } from '@ngx-translate/core';
import { ExportTrackingService } from '../analytics/export-tracking.service';

@Component({
  selector: 'app-footer',
  imports: [CdpLogoWithTextIconComponent, TranslateModule, RouterLink],
  templateUrl: './footer.html',
  standalone: true,
})
export class Footer {
  readonly allDataUrl = 'https://data.cdp.net/';

  constructor(private exportTracking: ExportTrackingService) {}

  trackAllDataExport(): void {
    this.exportTracking.trackExternalExport({
      destination_url: this.allDataUrl,
      export_type: 'all_data',
      source: 'footer_download_all_data',
    });
  }
}
