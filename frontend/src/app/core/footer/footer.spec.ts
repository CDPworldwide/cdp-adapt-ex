import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { Footer } from './footer';
import { ExportTrackingService } from '../analytics/export-tracking.service';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;
  let exportTracking: jasmine.SpyObj<ExportTrackingService>;

  beforeEach(async () => {
    exportTracking = jasmine.createSpyObj<ExportTrackingService>('ExportTrackingService', [
      'trackExternalExport',
    ]);

    await TestBed.configureTestingModule({
      imports: [Footer, TranslateModule.forRoot()],
      providers: [provideRouter([]), { provide: ExportTrackingService, useValue: exportTracking }],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links terms of use to the current CDP terms and conditions page', () => {
    const termsLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="https://www.cdp.net/en/terms-and-conditions"]',
    );

    expect(termsLink).not.toBeNull();
    expect(termsLink?.textContent?.trim()).toBe('locationCard.footer.termsOfUse');
  });

  it('tracks the all-data export link', () => {
    const downloadLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="https://data.cdp.net/"]',
    );

    downloadLink?.click();

    expect(exportTracking.trackExternalExport).toHaveBeenCalledWith({
      destination_url: 'https://data.cdp.net/',
      export_type: 'all_data',
      source: 'footer_download_all_data',
    });
  });
});
