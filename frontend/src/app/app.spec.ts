import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { GoogleMapsLoaderService } from './shared/services/google-maps-loader.service';
import { App } from './app';
import { GlobalSearchService } from './core/global-search/global-search.service';

describe('App', () => {
  let googleMapsLoaderService: jasmine.SpyObj<GoogleMapsLoaderService>;
  let globalSearchService: jasmine.SpyObj<GlobalSearchService>;

  beforeEach(async () => {
    googleMapsLoaderService = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    googleMapsLoaderService.loadApi.and.returnValue(of(true));
    globalSearchService = jasmine.createSpyObj('GlobalSearchService', ['open']);

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
        {
          provide: GlobalSearchService,
          useValue: globalSearchService,
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should open global search on command k', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    spyOn(event, 'preventDefault');

    app.onGlobalSearchKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(globalSearchService.open).toHaveBeenCalled();
  });
});
