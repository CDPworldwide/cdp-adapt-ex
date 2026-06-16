import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ReportingLeaderChipComponent } from './reporting-leader-chip.component';

describe('ReportingLeaderChipComponent', () => {
  let fixture: ComponentFixture<ReportingLeaderChipComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportingLeaderChipComponent, TranslateModule.forRoot()],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      maps: {
        reportingLeader: 'CDP Reporting Leader',
        reportingLeaderLink: 'View CDP Scores and A Lists.',
        reportingLeaderAriaLabel: 'Learn about CDP Reporting Leader status',
      },
    });
    translateService.use('en');

    fixture = TestBed.createComponent(ReportingLeaderChipComponent);
    fixture.detectChanges();
  });

  it('opens a tooltip with a link to CDP Scores and A Lists', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    button.click();
    fixture.detectChanges();

    const tooltip: HTMLElement = fixture.nativeElement.querySelector('[role="tooltip"]');
    const link: HTMLAnchorElement = tooltip.querySelector('a')!;

    expect(tooltip.textContent?.trim()).toBe('View CDP Scores and A Lists.');
    expect(link.href).toBe('https://www.cdp.net/en/data/scores');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });
});
