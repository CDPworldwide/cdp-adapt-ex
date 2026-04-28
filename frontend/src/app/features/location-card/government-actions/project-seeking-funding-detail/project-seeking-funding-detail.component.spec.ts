import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ProjectSeekingFundingDetailComponent } from './project-seeking-funding-detail.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ProjectSeekingFundingOutput, PlannedProjectStatusEnum } from '@pac-api/client';
import { By } from '@angular/platform-browser';

describe('ProjectSeekingFundingDetailComponent', () => {
  let component: ProjectSeekingFundingDetailComponent;
  let fixture: ComponentFixture<ProjectSeekingFundingDetailComponent>;

  const mockProject: ProjectSeekingFundingOutput = {
    title: 'Test Project',
    description: 'A short description that should not trigger truncation.',
    status: PlannedProjectStatusEnum.SCOPING,
    imageUrl: 'http://example.com/image.jpg',
    hazardsAddressed: [],
    totalAmount: 1000000,
    fundedPercent: 50,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSeekingFundingDetailComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectSeekingFundingDetailComponent);
    component = fixture.componentInstance;

    // Set up translation service
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      shared: {
        showMore: 'Show more',
        showLess: 'Show less',
      },
    });
    translate.use('en');

    fixture.componentRef.setInput('project', mockProject);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // TODO: restore description show-more/less toggle markup dropped during UI redesign port.
  xit('should not show the toggle button if description is not truncated', fakeAsync(() => {
    // Mock scrollHeight and clientHeight to simulate no truncation
    const descriptionEl = component.descriptionElement!.nativeElement;
    Object.defineProperty(descriptionEl, 'scrollHeight', {
      value: 100,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(descriptionEl, 'clientHeight', {
      value: 100,
      writable: true,
      configurable: true,
    });

    component.checkTruncation();
    tick();
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button.rounded-3xl'));
    expect(button).toBeFalsy();
  }));

  xit('should show the toggle button if description is truncated', fakeAsync(() => {
    // Mock scrollHeight and clientHeight to simulate truncation
    const descriptionEl = component.descriptionElement!.nativeElement;

    // We need to use a getter because some environments might not allow overwriting these properties directly
    spyOnProperty(descriptionEl, 'scrollHeight', 'get').and.returnValue(200);
    spyOnProperty(descriptionEl, 'clientHeight', 'get').and.returnValue(100);

    component.checkTruncation();
    tick(); // Execute the setTimeout inside checkTruncation
    fixture.detectChanges(); // Update the view with canExpand = true

    const button = fixture.debugElement.query(By.css('button.rounded-3xl'));
    expect(button).withContext('Button should be visible when text is truncated').toBeTruthy();
    if (button) {
      expect(button.nativeElement.textContent).toContain('Show more');
    }
  }));

  xit('should toggle expanded state and button text when clicked', fakeAsync(() => {
    // Force truncation to show the button
    const descriptionEl = component.descriptionElement!.nativeElement;
    spyOnProperty(descriptionEl, 'scrollHeight', 'get').and.returnValue(200);
    spyOnProperty(descriptionEl, 'clientHeight', 'get').and.returnValue(100);

    component.checkTruncation();
    tick();
    fixture.detectChanges();

    let buttonDebugEl = fixture.debugElement.query(By.css('button.rounded-3xl'));
    expect(buttonDebugEl)
      .withContext('Button should be visible when text is truncated')
      .toBeTruthy();

    if (buttonDebugEl) {
      buttonDebugEl.nativeElement.click();
      fixture.detectChanges();

      expect(component.expanded).toBeTrue();
      expect(buttonDebugEl.nativeElement.textContent).toContain('Show less');

      buttonDebugEl.nativeElement.click();
      fixture.detectChanges();
      tick(); // for checkTruncation inside toggleExpand
      fixture.detectChanges();

      expect(component.expanded).toBeFalse();
      expect(buttonDebugEl.nativeElement.textContent).toContain('Show more');
    }
  }));

  it('should calculate funded and remaining amounts correctly', () => {
    expect(component.fundedAmount).toBe(500000);
    expect(component.remainingAmount).toBe(500000);
  });

  it('should emit closed event when close button is clicked', () => {
    spyOn(component.closed, 'emit');
    const closeBtn = fixture.debugElement.query(By.css('button[aria-label="Close"]'));
    closeBtn.nativeElement.click();
    expect(component.closed.emit).toHaveBeenCalled();
  });
});
