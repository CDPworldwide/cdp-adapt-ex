import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { SolutionDetailModalComponent } from './solution-detail-modal.component';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { MOCK_LOCATION_DATA_WITH_SOLUTIONS, MOCK_SOLUTION_CARD } from './solutions.mock';

describe('SolutionDetailModalComponent', () => {
  let component: SolutionDetailModalComponent;
  let fixture: ComponentFixture<SolutionDetailModalComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<SolutionDetailModalComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close', 'updateSize', 'updatePosition']);

    await TestBed.configureTestingModule({
      imports: [SolutionDetailModalComponent, TranslateModule.forRoot()],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: dialogRefSpy },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            solution: MOCK_SOLUTION_CARD,
            location: MOCK_LOCATION_DATA_WITH_SOLUTIONS,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SolutionDetailModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with the first action', () => {
    expect(component.currentActionIndex).toBe(0);
    expect(component.currentAction?.title).toBe('Peer Action 1');
    expect(component.currentPeerName).toBe('Peer City 1');
  });

  it('should navigate to next and previous actions', () => {
    expect(component.totalActions).toBe(2);

    component.nextAction();
    expect(component.currentActionIndex).toBe(1);
    expect(component.currentAction?.title).toBe('Peer Action 2');
    expect(component.currentPeerName).toBe('Peer City 2');

    component.prevAction();
    expect(component.currentActionIndex).toBe(0);
    expect(component.currentAction?.title).toBe('Peer Action 1');
  });

  it('should not navigate beyond bounds', () => {
    component.prevAction();
    expect(component.currentActionIndex).toBe(0);

    component.nextAction();
    component.nextAction();
    expect(component.currentActionIndex).toBe(1);
  });

  it('should close the dialog', () => {
    component.close();
    expect(dialogRefSpy.close).toHaveBeenCalled();
  });
});
