import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-show-more-button',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './show-more-button.component.html',
})
export class ShowMoreButtonComponent {
  @Input() isExpanded = false;
  @Output() clicked = new EventEmitter<void>();

  onClick(): void {
    this.clicked.emit();
  }
}
