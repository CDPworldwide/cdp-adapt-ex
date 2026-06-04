import { Component, NO_ERRORS_SCHEMA, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, EMPTY, Observable, Subject, of, throwError } from 'rxjs';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { CityDetailPageComponent } from './city-detail';
import { LocationService } from '../../shared/services/location.service';
import { LocationCardComponent, type LocationCardTabKey } from '../location-card/location-card';
import { HazardMapService } from '../hazard-map/hazard-map.service';
import { GoogleMapsLoaderService } from '../../shared/services/google-maps-loader.service';
import { AskCdpAiService } from '../../core/ask-cdp-ai/ask-cdp-ai.service';
import { By } from '@angular/platform-browser';
import { LanguageService } from '../../shared/services/language.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<any> {
    return of({
      askCdpAi: {
        buttonText: 'Ask CDP AI',
        emptyState: {
          title: 'Ask a question about {{location}}.',
          description: 'Description',
        },
      },
    });
  }
}

@Component({
  selector: 'app-location-card',
  standalone: true,
  template: '',
})
class StubLocationCardComponent {
  data = input<any>(null);
  activeTab = input<LocationCardTabKey>('hazards');
  backToMap = output<void>();
  activeTabChange = output<LocationCardTabKey>();
}

describe('CityDetailPageComponent', () => {
  let component: CityDetailPageComponent;
  let fixture: ComponentFixture<CityDetailPageComponent>;
  let mockLocationService: jasmine.SpyObj<LocationService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockHazardMapService: jasmine.SpyObj<HazardMapService>;
  let mockGoogleMapsLoaderService: jasmine.SpyObj<GoogleMapsLoaderService>;
  let askCdpAiServiceMock: any;
  let routeParamMap$: BehaviorSubject<any>;
  let routeData$: BehaviorSubject<any>;

  const MOCK_LOCATION_DATA = {
    name: 'Junagadh',
    countryName: 'India',
    lat: 21.5222,
    lng: 70.4579,
    hazards: { statistics: {}, hazards: [] },
    governmentActions: { goals: [], actions: [] },
    solutions: { solutions: {} },
  } as any;

  beforeEach(async () => {
    mockLocationService = jasmine.createSpyObj('LocationService', ['getLocationByOrganizationId']);
    mockRouter = jasmine.createSpyObj('Router', [
      'navigate',
      'createUrlTree',
      'serializeUrl',
      'isActive',
    ]);
    (mockRouter as any).events = of();
    mockRouter.createUrlTree.and.returnValue({} as any);
    mockRouter.serializeUrl.and.returnValue('');
    mockRouter.isActive.and.returnValue(false);
    mockHazardMapService = jasmine.createSpyObj('HazardMapService', ['getHazardLayer']);
    mockGoogleMapsLoaderService = jasmine.createSpyObj('GoogleMapsLoaderService', ['loadApi']);
    routeParamMap$ = new BehaviorSubject(convertToParamMap({ organizationId: '867355' }));
    askCdpAiServiceMock = {
      conversationHistory: signal<any[]>([]),
      disclosure: signal<string | null>(null),
      isDisclosureLoading: signal<boolean>(false),
      disclosureError: signal<string | null>(null),
      followUpQuestions: signal<string[]>([]),
      isFollowUpLoading: signal<boolean>(false),
      followUpError: signal<string | null>(null),
      setLocationContext: jasmine.createSpy('setLocationContext'),
      clearSession: jasmine.createSpy('clearSession'),
      loadStarterQuestions: jasmine.createSpy('loadStarterQuestions').and.returnValue(of(void 0)),
      getFollowUpQuestions: jasmine.createSpy('getFollowUpQuestions').and.returnValue(of(void 0)),
      sendChatQuery: jasmine.createSpy('sendChatQuery').and.returnValue(of(void 0)),
    };

    mockHazardMapService.getHazardLayer.and.returnValue(of(null));
    mockGoogleMapsLoaderService.loadApi.and.returnValue(EMPTY);
    routeData$ = new BehaviorSubject({});

    await TestBed.configureTestingModule({
      imports: [
        CityDetailPageComponent,
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: FakeLoader },
        }),
      ],
      providers: [
        { provide: LocationService, useValue: mockLocationService },
        { provide: Router, useValue: mockRouter },
        { provide: HazardMapService, useValue: mockHazardMapService },
        { provide: GoogleMapsLoaderService, useValue: mockGoogleMapsLoaderService },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: routeParamMap$.asObservable(), data: routeData$.asObservable() },
        },
        { provide: AskCdpAiService, useValue: askCdpAiServiceMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(CityDetailPageComponent, {
        remove: { imports: [LocationCardComponent] },
        add: { imports: [StubLocationCardComponent] },
      })
      .compileComponents();

    TestBed.inject(TranslateService).use('en');

    mockLocationService.getLocationByOrganizationId.and.returnValue(of(MOCK_LOCATION_DATA));

    fixture = TestBed.createComponent(CityDetailPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads location details by organization ID', () => {
    expect(mockLocationService.getLocationByOrganizationId).toHaveBeenCalledWith('867355');
    expect(component.locationData).toEqual(MOCK_LOCATION_DATA);
    expect(component.isLoading).toBeFalse();
    expect(component.isNotFound).toBeFalse();
  });

  it('passes the active tab as the AI context area', () => {
    expect(askCdpAiServiceMock.setLocationContext).toHaveBeenCalledWith(
      MOCK_LOCATION_DATA,
      'hazards',
    );

    routeParamMap$.next(convertToParamMap({ organizationId: '867355', tab: 'solutions' }));
    fixture.detectChanges();

    expect(askCdpAiServiceMock.setLocationContext).toHaveBeenCalledWith(
      MOCK_LOCATION_DATA,
      'solutions',
    );
  });

  it('prefetches starter questions for the selected tab after loading the location', () => {
    expect(askCdpAiServiceMock.setLocationContext).toHaveBeenCalledWith(
      MOCK_LOCATION_DATA,
      'hazards',
    );
    expect(askCdpAiServiceMock.loadStarterQuestions).toHaveBeenCalled();
  });

  it('sets not found when API fails', () => {
    mockLocationService.getLocationByOrganizationId.and.returnValue(
      throwError(() => new Error('404')),
    );

    routeParamMap$.next(convertToParamMap({ organizationId: '999999' }));
    fixture.detectChanges();

    expect(component.isLoading).toBeFalse();
    expect(component.isNotFound).toBeTrue();
    expect(component.locationData).toBeNull();
  });

  it('ignores stale location responses after the language changes', () => {
    const languageService = TestBed.inject(LanguageService);
    const spanishLocation = {
      ...MOCK_LOCATION_DATA,
      reportingLanguage: 'es',
      hazards: { statistics: {}, hazards: [{ description: 'es drought' }] },
    } as any;
    const japaneseLocation = {
      ...MOCK_LOCATION_DATA,
      reportingLanguage: 'ja',
      hazards: { statistics: {}, hazards: [{ description: 'ja drought' }] },
    } as any;
    const spanishResponse$ = new Subject<any>();
    const japaneseResponse$ = new Subject<any>();

    mockLocationService.getLocationByOrganizationId.calls.reset();
    mockLocationService.getLocationByOrganizationId.and.returnValues(
      spanishResponse$,
      japaneseResponse$,
    );

    languageService.switchLanguage('es');
    fixture.detectChanges();
    languageService.switchLanguage('ja');
    fixture.detectChanges();

    spanishResponse$.next(spanishLocation);
    spanishResponse$.complete();
    fixture.detectChanges();

    expect(component.locationData).toBeNull();
    expect(component.isLoading).toBeTrue();

    japaneseResponse$.next(japaneseLocation);
    japaneseResponse$.complete();
    fixture.detectChanges();

    expect(component.locationData).toBe(japaneseLocation);
    expect(component.isLoading).toBeFalse();
  });

  it('navigates when tabs change', () => {
    component.onTabChange('actions');

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/org', '867355', 'actions']);
  });

  it('should open the AI sidebar without fetching starter questions again', () => {
    component.isAiOpen = false;
    fixture.detectChanges();
    const starterQuestionFetchCount = askCdpAiServiceMock.loadStarterQuestions.calls.count();
    const button = fixture.debugElement.query(By.css('[data-testid="ask-ai-toggle"]'));
    expect(button).toBeTruthy();

    button.nativeElement.click();
    fixture.detectChanges();

    expect(component.isAiOpen).toBeTrue();
    expect(askCdpAiServiceMock.loadStarterQuestions.calls.count()).toBe(starterQuestionFetchCount);
  });

  it('opens the AI sidebar automatically when route data requests it', () => {
    component.isAiOpen = false;
    askCdpAiServiceMock.loadStarterQuestions.calls.reset();

    routeData$.next({ openAiPanel: true });
    fixture.detectChanges();

    expect(component.isAiOpen).toBeTrue();
    expect(askCdpAiServiceMock.loadStarterQuestions).toHaveBeenCalled();
  });

  it('should simulate clicking on one of the suggestion follow ups', () => {
    // Setup state: AI panel is open, suggestions are available
    component.isAiOpen = true;
    askCdpAiServiceMock.conversationHistory.set([
      { role: 'user', content: 'Previous question' },
      { role: 'assistant', content: 'Previous answer' },
    ]);
    askCdpAiServiceMock.followUpQuestions.set(['Follow Up 1', 'Follow Up 2']);
    fixture.detectChanges();

    const suggestions = fixture.debugElement.queryAll(By.css('[data-testid="ask-ai-suggestion"]'));
    expect(suggestions.length).toBeGreaterThan(0);

    const firstSuggestion = suggestions[0];
    firstSuggestion.nativeElement.click();
    fixture.detectChanges();

    const clickedQuestion = askCdpAiServiceMock.followUpQuestions()[0];
    expect(askCdpAiServiceMock.sendChatQuery).toHaveBeenCalledWith(clickedQuestion);
  });

  it('should simulate sending a custom response', () => {
    component.isAiOpen = true;
    fixture.detectChanges();

    const input = fixture.debugElement.query(By.css('[data-testid="ask-ai-input"]'));
    expect(input).toBeTruthy();

    const customQuery = 'My custom question';
    const askCdpAiComponent = fixture.debugElement.query(
      By.css('app-ask-cdp-ai'),
    ).componentInstance;
    askCdpAiComponent.userQuery = customQuery;
    fixture.detectChanges();

    const sendButton = fixture.debugElement.query(By.css('[data-testid="ask-ai-send-button"]'));
    expect(sendButton.nativeElement.disabled).toBeFalse();

    sendButton.nativeElement.click();
    fixture.detectChanges();

    expect(askCdpAiServiceMock.sendChatQuery).toHaveBeenCalledWith(customQuery);
  });
});
