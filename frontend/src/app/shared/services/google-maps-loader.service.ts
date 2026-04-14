import { Injectable } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
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

  constructor() {}

  public loadApi(): Observable<boolean> {
    if (this.isApiLoading) {
      return this.apiLoaded.asObservable();
    }

    if (window.google && window.google.maps) {
      this.apiLoaded.next(true);
      return this.apiLoaded.asObservable();
    }

    this.isApiLoading = true;
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.mapsConfig.apiKey}&libraries=geometry,marker`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      this.isApiLoading = false;
      this.apiLoaded.next(true);
      this.apiLoaded.complete();
    };

    script.onerror = () => {
      this.isApiLoading = false;
      this.apiLoaded.error('Google Maps API script failed to load.');
    };

    document.head.appendChild(script);

    return this.apiLoaded.asObservable();
  }
}
