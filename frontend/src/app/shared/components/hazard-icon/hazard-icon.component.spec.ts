import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HazardIconComponent } from './hazard-icon.component';
import { HazardEnum } from '@pac-api/client';
import { By } from '@angular/platform-browser';
import { TranslateModule } from '@ngx-translate/core';

describe('HazardIconComponent', () => {
  let component: HazardIconComponent;
  let fixture: ComponentFixture<HazardIconComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HazardIconComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(HazardIconComponent);
    component = fixture.componentInstance;
  });

  it('should render correct icon for correct hazard', () => {
    component.hazard = 'FIRE_WEATHER' as HazardEnum;
    fixture.detectChanges();
    const icon = fixture.debugElement.query(By.css('app-fire-weather-icon'));
    expect(icon).toBeTruthy();
  });

  it('should render others icon by default', () => {
    component.hazard = 'UNKNOWN_HAZARD' as any;
    fixture.detectChanges();
    const icon = fixture.debugElement.query(By.css('app-other-hazard-icon'));
    expect(icon).toBeTruthy();
  });
});
