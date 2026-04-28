import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { AppHeaderComponent } from '../../shared/app-header/app-header';

interface FaqItem {
  id: string;
}

@Component({
  selector: 'app-learn-more',
  standalone: true,
  imports: [CommonModule, TranslateModule, AppHeaderComponent],
  templateUrl: './learn-more.html',
  styleUrls: ['./learn-more.css'],
})
export class LearnMoreComponent {
  readonly faqItems: FaqItem[] = [
    { id: 'data' },
    { id: 'updates' },
    { id: 'coverage' },
    { id: 'contribute' },
    { id: 'use' },
  ];

  private readonly openAccordions = signal<Set<string>>(new Set());

  isOpen(id: string): boolean {
    return this.openAccordions().has(id);
  }

  toggle(id: string): void {
    this.openAccordions.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}
