import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { GoogleMapsLoaderService } from './shared/services/google-maps-loader.service';
import { App } from './app';

describe('App', () => {
  let googleMapsLoaderService: jasmine.SpyObj<GoogleMapsLoaderService>;

  beforeEach(async () => {
    googleMapsLoaderService = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    googleMapsLoaderService.loadApi.and.returnValue(of(true));

    await TestBed.configureTestingModule({
      imports: [App, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: GoogleMapsLoaderService,
          useValue: googleMapsLoaderService,
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
