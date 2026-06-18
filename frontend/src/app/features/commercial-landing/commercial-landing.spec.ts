import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { CommercialLandingComponent } from './commercial-landing';

describe('CommercialLandingComponent', () => {
  let fixture: ComponentFixture<CommercialLandingComponent>;
  let title: Title;
  let meta: Meta;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommercialLandingComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({ commercialLandingKey: 'insurance' }),
          },
        },
      ],
    }).compileComponents();

    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
    fixture = TestBed.createComponent(CommercialLandingComponent);
    fixture.detectChanges();
  });

  it('renders the route-specific commercial landing page', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Climate adaptation intelligence for insurance teams');
    expect(text).toContain('Insurance and reinsurance teams');
    expect(text).toContain('Explore local hazards');
  });

  it('sets route-specific browser metadata', () => {
    expect(title.getTitle()).toBe('Climate adaptation intelligence for insurance teams | CDP');
    expect(meta.getTag('name="description"')?.content).toContain(
      'Use CDP local climate hazard and adaptation action data',
    );
  });
});
