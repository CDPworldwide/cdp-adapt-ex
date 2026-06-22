import { Injectable } from '@angular/core';
import { Observable, ReplaySubject, of } from 'rxjs';
import { environment } from '@env/environment';

declare global {
  interface Window {
    google?: typeof google.maps;
  }
}

@Injectable({
  providedIn: 'root',
})
export class GoogleMapsLoaderService {
  private apiLoaded: ReplaySubject<boolean> = new ReplaySubject<boolean>(1);
  private isApiLoading = false;
  private isApiLoaded = false;
  private hasWarnedMissingApiKey = false;

  constructor() {}

  public loadApi(): Observable<boolean> {
    if (!environment.mapsConfig.apiKey) {
      if (!this.hasWarnedMissingApiKey) {
        console.warn('Google Maps API key is not configured; map rendering is disabled.');
        this.hasWarnedMissingApiKey = true;
      }
      return of(false);
    }

    if (window.google && window.google.maps) {
      this.isApiLoaded = true;
      return of(true);
    }

    if (this.isApiLoaded && window.google?.maps) {
      return of(true);
    }

    this.isApiLoaded = false;

    if (this.isApiLoading) {
      return this.apiLoaded.asObservable();
    }

    this.isApiLoading = true;
    const loadResult = new ReplaySubject<boolean>(1);
    this.apiLoaded = loadResult;

    document
      .querySelectorAll('script[src^="https://maps.googleapis.com/maps/api/js"]')
      .forEach((existingScript) => existingScript.remove());

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.mapsConfig.apiKey}&libraries=geometry,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      this.isApiLoading = false;
      this.isApiLoaded = true;
      loadResult.next(true);
      loadResult.complete();
    };

    script.onerror = () => {
      this.isApiLoading = false;
      console.error('Google Maps API script failed to load.');
      loadResult.next(false);
      loadResult.complete();
      this.apiLoaded = new ReplaySubject<boolean>(1);
    };

    document.head.appendChild(script);

    return loadResult.asObservable();
  }
}
