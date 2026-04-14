import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShowMoreButtonComponent } from './show-more-button.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

describe('ShowMoreButtonComponent', () => {
  let component: ShowMoreButtonComponent;
  let fixture: ComponentFixture<ShowMoreButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowMoreButtonComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowMoreButtonComponent);
    component = fixture.componentInstance;

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      shared: {
        showMore: 'Show more hazards',
      },
    });
    translateService.use('en');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the correct label', () => {
    const button = fixture.nativeElement.querySelector('button');
    expect(button.textContent.trim()).toBe('Show more hazards');
  });

  it('should emit clicked event when button is clicked', () => {
    spyOn(component.clicked, 'emit');
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    expect(component.clicked.emit).toHaveBeenCalled();
  });
});
