import { TestBed } from '@angular/core/testing';

import { environment } from '@env/environment';
import { GoogleMapsLoaderService } from './google-maps-loader.service';

describe('GoogleMapsLoaderService', () => {
  const originalApiKey = environment.mapsConfig.apiKey;
  const originalGoogle = (window as any).google;

  afterEach(() => {
    environment.mapsConfig.apiKey = originalApiKey;
    (window as any).google = originalGoogle;
    document
      .querySelectorAll('script[src^="https://maps.googleapis.com/maps/api/js"]')
      .forEach((script) => script.remove());
    TestBed.resetTestingModule();
  });

  it('should emit false instead of erroring when the Google Maps script fails to load', (done) => {
    environment.mapsConfig.apiKey = 'test-key';
    (window as any).google = undefined;
    spyOn(console, 'error');

    TestBed.configureTestingModule({});
    const service = TestBed.inject(GoogleMapsLoaderService);

    service.loadApi().subscribe({
      next: (loaded) => {
        expect(loaded).toBeFalse();
        expect(console.error).toHaveBeenCalledWith('Google Maps API script failed to load.');
      },
      error: done.fail,
      complete: done,
    });

    const script = document.querySelector(
      'script[src^="https://maps.googleapis.com/maps/api/js"]',
    ) as HTMLScriptElement;
    expect(script).toBeTruthy();
    script.onerror?.(new Event('error'));
  });

  it('should create a new script load attempt after a previous load fails', (done) => {
    environment.mapsConfig.apiKey = 'test-key';
    (window as any).google = undefined;
    spyOn(console, 'error');

    TestBed.configureTestingModule({});
    const service = TestBed.inject(GoogleMapsLoaderService);

    service.loadApi().subscribe({
      next: (loaded) => expect(loaded).toBeFalse(),
      error: done.fail,
      complete: () => {
        service.loadApi().subscribe({
          next: (loaded) => expect(loaded).toBeTrue(),
          error: done.fail,
          complete: done,
        });

        const secondScript = document.querySelector(
          'script[src^="https://maps.googleapis.com/maps/api/js"]',
        ) as HTMLScriptElement;
        expect(secondScript).toBeTruthy();
        secondScript.onload?.(new Event('load'));
      },
    });

    const firstScript = document.querySelector(
      'script[src^="https://maps.googleapis.com/maps/api/js"]',
    ) as HTMLScriptElement;
    expect(firstScript).toBeTruthy();
    firstScript.onerror?.(new Event('error'));
  });
});
