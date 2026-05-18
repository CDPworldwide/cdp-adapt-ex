import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  ChangeDetectorRef,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdaptationAction, LocationProfile, SolutionCard } from '@pac-api/client';
import {
  AdaptationActionDetailComponent,
  DETAIL_HERO_BACKGROUND,
} from '../government-actions/adaptation-action-detail/adaptation-action-detail.component';
import { HazardIconComponent } from '../../../shared/components/hazard-icon/hazard-icon.component';
import {
  ArrowRightIconComponent,
  ArrowLeftIconComponent,
  ArrowRightLongIconComponent,
  ArrowLeftLongIconComponent,
  CloseIconComponent,
} from '../../../shared/icons';
import { ProtectedTranslationHtmlPipe } from '../../../shared/pipes/protected-translation-html.pipe';

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
    ArrowRightLongIconComponent,
    ArrowLeftLongIconComponent,
    CloseIconComponent,
    ProtectedTranslationHtmlPipe,
  ],
  templateUrl: './solution-detail-modal.component.html',
  styleUrl: './solution-detail-modal.component.css',
  encapsulation: ViewEncapsulation.None,
})
export class SolutionDetailModalComponent implements OnInit, OnDestroy {
  public data = inject<{
    solution: SolutionCard;
    location: LocationProfile | null;
  }>(MAT_DIALOG_DATA);

  private dialogRef = inject(MatDialogRef<SolutionDetailModalComponent>);
  private breakpointObserver = inject(BreakpointObserver);
  private cdr = inject(ChangeDetectorRef);

  currentActionIndex = 0;
  slideClass = '';
  @ViewChild('outerContainer') private outerContainer?: ElementRef<HTMLElement>;
  @ViewChild('detailContainer') private detailContainer?: ElementRef<HTMLElement>;
  private destroy$ = new Subject<void>();

  getBackgroundStyle(_solution: SolutionCard): string {
    return DETAIL_HERO_BACKGROUND;
  }

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
      this.dialogRef.updateSize('80vw', '80vh');
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
      this.slide('right');
      this.scrollToTop();
    }
  }

  prevAction(): void {
    if (this.currentActionIndex > 0) {
      this.currentActionIndex--;
      this.slide('left');
      this.scrollToTop();
    }
  }

  // Mobile uses outer scroll; desktop uses the detail column. Reset both.
  private scrollToTop(): void {
    this.outerContainer?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
    this.detailContainer?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private slide(dir: 'right' | 'left'): void {
    this.slideClass = '';
    this.cdr.detectChanges();
    requestAnimationFrame(() => {
      this.slideClass = dir === 'right' ? 'slide-from-right' : 'slide-from-left';
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
