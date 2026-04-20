import { TestBed } from '@angular/core/testing';
import { AskCdpAiService } from './ask-cdp-ai.service';
import { type LocationProfileInput } from '@pac-api/client';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

describe('AskCdpAiService', () => {
  let service: AskCdpAiService;
  let translate: TranslateService;
  let originalFetch: any;
  const mockLocationData: LocationProfileInput = {
    organizationId: 12345,
    name: 'New York',
    countryName: 'United States',
    lat: 40.7128,
    lng: -74.006,
    geometry: { type: 'Point', coordinates: [-74.006, 40.7128] },
    hazards: {
      statistics: {
        populationExposedValue: null,
        populationExposedPercentage: null,
        gdpAtRiskValue: null,
        gdpAtRiskPercentage: null,
        gdpAtRiskCurrencyCode: null,
        vulnerableSectors: [],
      },
      hazards: [],
    },
    governmentActions: {
      goals: [],
      actions: [],
      projects: [],
    },
    solutions: {
      solutions: {},
    },
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslateModule.forRoot()],
      providers: [AskCdpAiService],
    });
    service = TestBed.inject(AskCdpAiService);
    translate = TestBed.inject(TranslateService);
    translate.use('en');
    translate.setTranslation('en', {
      askCdpAi: {
        starterQuestions: {
          primaryHazards: 'Hazards for {{location}}',
          governmentActions: 'Actions in {{location}}',
          solutions: 'Solutions for {{location}}',
          funding: 'Funding in {{location}}',
          primaryHazardDetails: 'Hazard details for {{location}}',
        },
      },
    });

    // Mock window.fetch
    originalFetch = window.fetch;
    window.fetch = jasmine.createSpy('fetch');
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getFollowUpQuestions', () => {
    it('should build starter questions locally with location context', (done) => {
      service.setLocationContext(mockLocationData);

      service.loadStarterQuestions().subscribe(() => {
        expect(window.fetch).not.toHaveBeenCalled();
        expect(service.followUpQuestions().length).toBe(3);
        expect(
          service.followUpQuestions().every((question) => question.includes('New York')),
        ).toBeTrue();
        expect(service.isFollowUpLoading()).toBeFalse();
        done();
      });
    });

    it('should successfully get follow-up questions', (done) => {
      service.setLocationContext(mockLocationData);
      // Correct structure: follow_up_questions at root
      const mockResponse = {
        follow_up_questions: ['Question 1?', 'Question 2?'],
      };

      (window.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => Promise.resolve(mockResponse),
          text: () => Promise.resolve(JSON.stringify(mockResponse)),
        }),
      );

      service.getFollowUpQuestions().subscribe(() => {
        expect(service.followUpQuestions()).toEqual(['Question 1?', 'Question 2?']);
        expect(service.isFollowUpLoading()).toBeFalse();
        expect(service.followUpError()).toBeNull();
        void readMostRecentRequestBody().then((body) => {
          expect(body.locationData).toEqual(mockLocationData);
          done();
        });
      });
    });

    it('should handle error when getting follow-up questions fails', (done) => {
      service.setLocationContext(mockLocationData);
      (window.fetch as jasmine.Spy).and.returnValue(Promise.reject(new Error('Fetch error')));

      service.getFollowUpQuestions().subscribe(() => {
        expect(service.followUpError()).toBe('Fetch error');
        expect(service.isFollowUpLoading()).toBeFalse();
        done();
      });
    });

    it('should not fetch starter questions when disclosure already exists', (done) => {
      service.setLocationContext(mockLocationData);
      service.disclosure.set('Existing disclosure');

      service.loadStarterQuestions().subscribe(() => {
        expect(window.fetch).not.toHaveBeenCalled();
        expect(service.isFollowUpLoading()).toBeFalse();
        done();
      });
    });

    it('should not fetch starter questions when starter questions already exist', (done) => {
      service.setLocationContext(mockLocationData);
      service.followUpQuestions.set(['Existing question']);

      service.loadStarterQuestions().subscribe(() => {
        expect(window.fetch).not.toHaveBeenCalled();
        expect(service.isFollowUpLoading()).toBeFalse();
        done();
      });
    });
  });

  describe('sendChatQuery', () => {
    it('should successfully send chat query and then load follow-up questions', (done) => {
      service.setLocationContext(mockLocationData);
      const chatResponse = {
        choices: [
          {
            message: {
              content: 'Chat response',
            },
          },
        ],
      };
      const followUpResponse = {
        follow_up_questions: ['Question 1?', 'Question 2?', 'Question 3?'],
      };

      (window.fetch as jasmine.Spy).and.returnValues(
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => Promise.resolve(chatResponse),
          text: () => Promise.resolve(JSON.stringify(chatResponse)),
        }),
        Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'Content-Type': 'application/json' }),
          json: () => Promise.resolve(followUpResponse),
          text: () => Promise.resolve(JSON.stringify(followUpResponse)),
        }),
      );

      // Mock marked to return the expected HTML
      spyOn(service, 'parseToHtml').and.returnValue('<p>Chat response</p>');

      service.sendChatQuery('Hello').subscribe(() => {
        expect(service.disclosure()).toContain('<p>Chat response</p>');
        expect(service.followUpQuestions()).toEqual(followUpResponse.follow_up_questions);
        expect(service.isDisclosureLoading()).toBeFalse();
        expect(service.isFollowUpLoading()).toBeFalse();
        expect(window.fetch).toHaveBeenCalledTimes(2);
        Promise.all([readRequestBodyAt(0), readRequestBodyAt(1)]).then(
          ([chatBody, followUpBody]) => {
            expect(chatBody.locationData).toEqual(mockLocationData);
            expect(chatBody.messages.at(-1)?.content).toBe('Hello');
            expect(followUpBody.locationData).toEqual(mockLocationData);
            const lastMessage = service.conversationHistory().at(-1);
            expect(lastMessage?.content).toBe('<p>Chat response</p>');
            done();
          },
        );
      });
    });
  });

  function readRequestBodyAt(index: number): Promise<any> {
    const request = (window.fetch as jasmine.Spy).calls.argsFor(index)[0] as Request;
    return request.clone().json();
  }

  function readMostRecentRequestBody(): Promise<any> {
    return readRequestBodyAt((window.fetch as jasmine.Spy).calls.count() - 1);
  }
});
