import { TestBed } from '@angular/core/testing';
import { AskCdpAiService } from './ask-cdp-ai.service';
import { type LocationProfile } from '@pac-api/client';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { environment } from '@env/environment';

describe('AskCdpAiService', () => {
  let service: AskCdpAiService;
  let translate: TranslateService;
  let originalFetch: any;
  const mockLocationData: LocationProfile = {
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
      goals: [
        {
          title: 'Heat goal',
          hazardsAddressed: [{ hazardType: 'EXTREME_HEAT' as any }],
        },
        {
          title: 'Flood goal',
          hazardsAddressed: [{ hazardType: 'URBAN_FLOODING' as any }],
        },
      ],
      actions: [
        {
          title: 'Heat action',
          hazardsAddressed: [{ hazardType: 'EXTREME_HEAT' as any }],
        },
        {
          title: 'Flood action',
          hazardsAddressed: [{ hazardType: 'URBAN_FLOODING' as any }],
        },
      ],
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
    it('should fetch starter questions from the AI server with location context', (done) => {
      service.setLocationContext(mockLocationData);
      (window.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify({
              follow_up_questions: [
                'What hazards affect New York?',
                'What actions are planned in New York?',
                'What projects need funding in New York?',
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      );

      service.loadStarterQuestions().subscribe(() => {
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(service.followUpQuestions().length).toBe(3);
        expect(
          service.followUpQuestions().every((question) => question.includes('New York')),
        ).toBeTrue();
        expect(service.isFollowUpLoading()).toBeFalse();
        readRequestBodyAt(0).then((body) => {
          expect(String((window.fetch as jasmine.Spy).calls.argsFor(0)[0])).toContain(
            '/v1/suggest-follow-ups',
          );
          expect(String((window.fetch as jasmine.Spy).calls.argsFor(0)[0])).toBe(
            `${environment.aiServerUrl}/v1/suggest-follow-ups`,
          );
          expect(body.locationData).toEqual(mockLocationData);
          expect(body.contextArea).toBe('hazards');
          expect(body.metadata.contextArea).toBe('hazards');
          expect(body.messages.at(-1)?.role).toBe('user');
          done();
        });
      });
    });

    it('should fetch follow-up questions from the AI server', (done) => {
      service.setLocationContext(mockLocationData);
      service.conversationHistory.set([{ role: 'user', content: 'Hello' }]);
      (window.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve(
          new Response(
            JSON.stringify({
              follow_up_questions: ['Question 1', 'Question 2', 'Question 3'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        ),
      );

      service.getFollowUpQuestions().subscribe(() => {
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(service.followUpQuestions().length).toBe(3);
        expect(service.isFollowUpLoading()).toBeFalse();
        expect(service.followUpError()).toBeNull();
        readRequestBodyAt(0).then((body) => {
          expect(String((window.fetch as jasmine.Spy).calls.argsFor(0)[0])).toContain(
            '/v1/suggest-follow-ups',
          );
          expect(body.messages.at(-1)?.content).toBe('Hello');
          done();
        });
      });
    });

    it('should set an error when the AI server follow-up request fails', (done) => {
      service.setLocationContext(mockLocationData);
      spyOn(console, 'error');
      (window.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve(new Response('Nope', { status: 500 })),
      );

      service.getFollowUpQuestions().subscribe(() => {
        expect(window.fetch).toHaveBeenCalledTimes(1);
        expect(service.followUpError()).toBe('Nope');
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
      (window.fetch as jasmine.Spy).and.callFake((url: string) => {
        if (String(url).includes('/v1/chat/completions')) {
          return Promise.resolve(
            new Response(
              [
                'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}',
                '',
                'data: {"choices":[{"delta":{"content":"Chat response"},"finish_reason":null}]}',
                '',
                'data: [DONE]',
                '',
              ].join('\n'),
              {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(
            JSON.stringify({
              follow_up_questions: ['Question 1', 'Question 2', 'Question 3'],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        );
      });

      // Mock marked to return the expected HTML
      spyOn(service, 'parseToHtml').and.returnValue('<p>Chat response</p>');

      service.sendChatQuery('Hello').subscribe(() => {
        expect(service.disclosure()).toContain('<p>Chat response</p>');
        expect(service.followUpQuestions().length).toBe(3);
        expect(service.isDisclosureLoading()).toBeFalse();
        expect(service.isFollowUpLoading()).toBeFalse();
        expect(window.fetch).toHaveBeenCalledTimes(2);
        Promise.all([readRequestBodyAt(0), readRequestBodyAt(1)]).then(
          ([chatBody, followUpBody]) => {
            expect(String((window.fetch as jasmine.Spy).calls.argsFor(0)[0])).toContain(
              '/v1/chat/completions',
            );
            expect(String((window.fetch as jasmine.Spy).calls.argsFor(0)[0])).toBe(
              `${environment.aiServerUrl}/v1/chat/completions`,
            );
            expect(String((window.fetch as jasmine.Spy).calls.argsFor(1)[0])).toContain(
              '/v1/suggest-follow-ups',
            );
            expect(String((window.fetch as jasmine.Spy).calls.argsFor(1)[0])).toBe(
              `${environment.aiServerUrl}/v1/suggest-follow-ups`,
            );
            expect(chatBody.metadata.locationData).toEqual(mockLocationData);
            expect(chatBody.contextArea).toBe('hazards');
            expect(chatBody.metadata.contextArea).toBe('hazards');
            expect(chatBody.messages.at(-1)?.content).toBe('Hello');
            expect(followUpBody.messages.at(-1)?.content).toBe('Chat response');
            const lastMessage = service.conversationHistory().at(-1);
            expect(lastMessage?.content).toBe('<p>Chat response</p>');
            done();
          },
        );
      });
    });

    it('should send the active page context area to the AI server', (done) => {
      service.setLocationContext(mockLocationData, 'solutions');
      (window.fetch as jasmine.Spy).and.callFake((url: string) => {
        if (String(url).includes('/v1/chat/completions')) {
          return Promise.resolve(
            new Response(
              [
                'data: {"choices":[{"delta":{"content":"Solutions response"}}]}',
                '',
                'data: [DONE]',
                '',
              ].join('\n'),
              {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ follow_up_questions: ['Question 1'] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });
      spyOn(service, 'parseToHtml').and.returnValue('<p>Solutions response</p>');

      service.sendChatQuery('What solutions are common?').subscribe(() => {
        readRequestBodyAt(0).then((body) => {
          expect(body.contextArea).toBe('solutions');
          expect(body.metadata.contextArea).toBe('solutions');
          done();
        });
      });
    });

    it('should send filtered actions-tab context when a hazard filter is active', (done) => {
      service.setLocationContext(mockLocationData, 'actions', 'EXTREME_HEAT|');
      (window.fetch as jasmine.Spy).and.callFake((url: string) => {
        if (String(url).includes('/v1/chat/completions')) {
          return Promise.resolve(
            new Response(
              [
                'data: {"choices":[{"delta":{"content":"Filtered response"}}]}',
                '',
                'data: [DONE]',
                '',
              ].join('\n'),
              {
                status: 200,
                headers: { 'Content-Type': 'text/event-stream' },
              },
            ),
          );
        }

        return Promise.resolve(
          new Response(JSON.stringify({ follow_up_questions: ['Question 1'] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      });
      spyOn(service, 'parseToHtml').and.returnValue('<p>Filtered response</p>');

      service.sendChatQuery('How many goals are visible?').subscribe(() => {
        readRequestBodyAt(0).then((body) => {
          expect(body.contextArea).toBe('actions');
          expect(body.metadata.locationData.governmentActions.goals.length).toBe(1);
          expect(body.metadata.locationData.governmentActions.goals[0].title).toBe('Heat goal');
          expect(body.metadata.locationData.governmentActions.actions.length).toBe(1);
          expect(body.metadata.locationData.governmentActions.actions[0].title).toBe('Heat action');
          done();
        });
      });
    });
  });

  describe('parseToHtml', () => {
    beforeEach(() => {
      translate.setTranslation('en', {
        askCdpAi: {
          sources: 'Sources',
        },
      });
      translate.use('en');
    });

    it('removes inline footnote markers and keeps a deduped sources block', () => {
      const html = service.parseToHtml(
        [
          'Urban flooding has caused major losses.[^1]',
          'Drought creates economic stress.[^1]',
          '',
          'Sources:',
          '[^1]: George Local Municipality 2025 CDP-ICLEI Track disclosure.',
          '[^2]: George Local Municipality 2025 CDP-ICLEI Track disclosure.',
        ].join('\n'),
      );
      const doc = new DOMParser().parseFromString(html, 'text/html');

      expect(html).not.toContain('[^1]');
      expect(doc.querySelector('.ai-citation')).toBeNull();
      expect(doc.querySelector('.ai-sources-title')?.textContent).toBe('Sources');
      expect(doc.querySelectorAll('.ai-sources li').length).toBe(1);
    });

    it('uses a readable sources label when translations are not ready', () => {
      translate.setTranslation('en', {});

      const html = service.parseToHtml(
        [
          'Urban flooding has caused major losses.[^1]',
          '',
          'Sources:',
          '[^1]: George Local Municipality 2025 CDP-ICLEI Track disclosure.',
        ].join('\n'),
      );
      const doc = new DOMParser().parseFromString(html, 'text/html');

      expect(doc.querySelector('.ai-sources-title')?.textContent).toBe('Sources');
    });
  });

  function readRequestBodyAt(index: number): Promise<any> {
    const [request, init] = (window.fetch as jasmine.Spy).calls.argsFor(index) as [
      Request | string,
      RequestInit | undefined,
    ];

    if (request instanceof Request) {
      return request.clone().json();
    }

    return Promise.resolve(JSON.parse(String(init?.body)));
  }
});
