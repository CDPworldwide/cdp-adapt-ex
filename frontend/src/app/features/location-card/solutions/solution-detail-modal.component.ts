import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdaptationAction, LocationProfile, SolutionCardOutput } from '@pac-api/client';
import { AdaptationActionDetailComponent } from '../government-actions/adaptation-action-detail/adaptation-action-detail.component';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import {
  ArrowRightIconComponent,
  ArrowLeftIconComponent,
  CloseIconComponent,
} from '../../../shared/icons';
import { AutoTranslatePipe } from '../../../shared/pipes/auto-translate.pipe';

@Component({
  selector: 'app-solution-detail-modal',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MatDialogModule,
    AdaptationActionDetailComponent,
    HazardIconComponent,
    ArrowRightIconComponent,
    ArrowLeftIconComponent,
    CloseIconComponent,
    AutoTranslatePipe,
  ],
  templateUrl: './solution-detail-modal.component.html',
})
export class SolutionDetailModalComponent implements OnInit, OnDestroy {
  public data = inject<{
    solution: SolutionCardOutput;
    location: LocationProfile | null;
  }>(MAT_DIALOG_DATA);

  private dialogRef = inject(MatDialogRef<SolutionDetailModalComponent>);
  private breakpointObserver = inject(BreakpointObserver);

  currentActionIndex = 0;
  private destroy$ = new Subject<void>();

  constructor() {}

  ngOnInit(): void {
    this.breakpointObserver
      .observe([Breakpoints.Handset, '(max-width: 1023px)'])
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.updateDialogSize(result.matches);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateDialogSize(isMobile: boolean): void {
    if (isMobile) {
      this.dialogRef.updateSize('100%', '100%');
      this.dialogRef.updatePosition({ top: '0', left: '0' });
    } else {
      this.dialogRef.updateSize('75rem', 'auto');
      // For desktop, we want it centered. updatePosition({}) resets it to default (center).
      this.dialogRef.updatePosition({ top: '', left: '' });
    }
  }

  get currentPeerName(): string | undefined {
    return this.data.solution.peerActions?.[this.currentActionIndex]?.peerName || undefined;
  }

  get currentAction(): AdaptationAction | undefined {
    return this.data.solution.peerActions?.[this.currentActionIndex]?.action || undefined;
  }

  get totalActions(): number {
    return this.data.solution.peerActions?.length || 0;
  }

  nextAction(): void {
    if (this.currentActionIndex < this.totalActions - 1) {
      this.currentActionIndex++;
    }
  }

  prevAction(): void {
    if (this.currentActionIndex > 0) {
      this.currentActionIndex--;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
