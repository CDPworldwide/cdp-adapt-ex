import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ProjectSeekingFunding } from '@pac-api/client';
import { CloseIconComponent } from '../../../../shared/icons/close-icon.component';
import { ImagePlaceholderIconComponent } from '../../../../shared/icons/image-placeholder-icon.component';
import { AutoTranslatePipe } from '../../../../shared/pipes/auto-translate.pipe';

@Component({
  selector: 'app-project-seeking-funding-detail',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    CloseIconComponent,
    ImagePlaceholderIconComponent,
    AutoTranslatePipe,
  ],
  templateUrl: './project-seeking-funding-detail.component.html',
})
export class ProjectSeekingFundingDetailComponent implements AfterViewInit, OnChanges {
  @Input() project!: ProjectSeekingFunding;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('descriptionElement') descriptionElement?: ElementRef<HTMLElement>;

  expanded = false;
  canExpand = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.checkTruncation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['project']) {
      this.expanded = false;
      this.canExpand = false;
      this.checkTruncation();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.checkTruncation();
  }

  checkTruncation(): void {
    // Small timeout to allow the view to render
    setTimeout(() => {
      if (this.descriptionElement && !this.expanded) {
        const el = this.descriptionElement.nativeElement;
        // Use a 1px tolerance for subpixel rounding issues
        const isTruncated = el.scrollHeight > el.clientHeight + 1;
        if (this.canExpand !== isTruncated) {
          this.canExpand = isTruncated;
          this.cdr.detectChanges();
        }
      }
    }, 0);
  }

  get financeModels(): string[] {
    if (!this.project.financeModel) return [];
    return this.project.financeModel || [];
  }

  toggleExpand(): void {
    this.expanded = !this.expanded;
    if (!this.expanded) {
      this.checkTruncation();
    }
  }

  close(): void {
    this.closed.emit();
  }

  get fundedAmount(): number {
    if (this.project.totalAmount != null && this.project.fundedPercent != null) {
      return (this.project.totalAmount * this.project.fundedPercent) / 100;
    }
    return 0;
  }

  get remainingAmount(): number {
    if (this.project.totalAmount != null && this.project.fundedPercent != null) {
      return this.project.totalAmount * (1 - this.project.fundedPercent / 100);
    }
    return this.project.totalAmount ?? 0;
  }
}
