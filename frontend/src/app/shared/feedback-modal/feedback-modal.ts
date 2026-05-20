import { CommonModule } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FeedbackService } from '../services/feedback.service';

@Component({
  selector: 'app-feedback-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './feedback-modal.html',
})
export class FeedbackModalComponent {
  readonly feedbackService = inject(FeedbackService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.feedbackService.isOpen()) {
      this.feedbackService.close();
    }
  }
}
