import { Injectable } from '@angular/core';

import { PosthogService } from './posthog.service';
import type { AnalyticsProperties } from './analytics-events';

type ExportTrackingInput = AnalyticsProperties & {
  destination_url: string;
  export_type: 'all_data' | 'location_open_data' | 'raw_dataset';
  source: string;
};

type ExportTrackingProperties = ExportTrackingInput & {
  export_delivery: 'external_portal';
};

@Injectable({ providedIn: 'root' })
export class ExportTrackingService {
  constructor(private posthog: PosthogService) {}

  trackExternalExport(properties: ExportTrackingInput): void {
    const baseProperties: ExportTrackingProperties = {
      ...properties,
      export_delivery: 'external_portal',
    };

    this.posthog.capture('export_clicked', baseProperties);
    this.posthog.capture('export_completed', {
      ...baseProperties,
      completion_type: 'external_link_opened',
    });
  }

  trackExportFailed(properties: ExportTrackingInput, errorMessage?: string): void {
    this.posthog.capture('export_failed', {
      ...properties,
      export_delivery: 'external_portal',
      ...(errorMessage ? { error_message: errorMessage } : {}),
    });
  }
}
