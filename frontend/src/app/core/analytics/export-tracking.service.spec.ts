import { TestBed } from '@angular/core/testing';

import { ExportTrackingService } from './export-tracking.service';
import { PosthogService } from './posthog.service';

describe('ExportTrackingService', () => {
  let service: ExportTrackingService;
  let posthog: jasmine.SpyObj<PosthogService>;

  beforeEach(() => {
    posthog = jasmine.createSpyObj<PosthogService>('PosthogService', ['capture']);

    TestBed.configureTestingModule({
      providers: [{ provide: PosthogService, useValue: posthog }],
    });

    service = TestBed.inject(ExportTrackingService);
  });

  it('tracks external export handoffs as clicked and completed', () => {
    service.trackExternalExport({
      destination_url: 'https://data.cdp.net/',
      export_type: 'all_data',
      source: 'footer_download_all_data',
    });

    expect(posthog.capture).toHaveBeenCalledWith('export_clicked', {
      destination_url: 'https://data.cdp.net/',
      export_delivery: 'external_portal',
      export_type: 'all_data',
      source: 'footer_download_all_data',
    });
    expect(posthog.capture).toHaveBeenCalledWith('export_completed', {
      completion_type: 'external_link_opened',
      destination_url: 'https://data.cdp.net/',
      export_delivery: 'external_portal',
      export_type: 'all_data',
      source: 'footer_download_all_data',
    });
  });

  it('tracks export failures with the same event contract', () => {
    service.trackExportFailed(
      {
        destination_url: 'https://data.cdp.net/',
        export_type: 'raw_dataset',
        source: 'methodology_raw_data_link',
      },
      'Blocked by browser',
    );

    expect(posthog.capture).toHaveBeenCalledWith('export_failed', {
      destination_url: 'https://data.cdp.net/',
      error_message: 'Blocked by browser',
      export_delivery: 'external_portal',
      export_type: 'raw_dataset',
      source: 'methodology_raw_data_link',
    });
  });
});
