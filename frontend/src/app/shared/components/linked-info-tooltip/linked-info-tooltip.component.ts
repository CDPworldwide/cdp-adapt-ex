import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-linked-info-tooltip',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './linked-info-tooltip.component.html',
  styles: [':host { display: inline-flex; position: relative; vertical-align: middle; }'],
})
export class LinkedInfoTooltipComponent {
  @Input({ required: true }) ariaLabel = '';
  @Input({ required: true }) linkLabel = '';
  @Input() href?: string;
  @Input() routerLink?: string;
  @Input() tooltipPositionClass = 'left-1/2 -translate-x-1/2';
  @Input() triggerClass = '';
  @Input() linkTarget: '_blank' | '_self' = '_self';
  @Input() linkRel: string | null = null;

  protected open = false;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('mouseenter')
  onEnter(): void {
    this.open = true;
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.open = false;
  }

  @HostListener('focusin')
  onFocusIn(): void {
    this.open = true;
  }

  @HostListener('focusout', ['$event.relatedTarget'])
  onFocusOut(relatedTarget: EventTarget | null): void {
    if (!this.host.nativeElement.contains(relatedTarget as Node)) {
      this.open = false;
    }
  }

  openTooltip(): void {
    this.open = true;
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!this.host.nativeElement.contains(target as Node)) {
      this.open = false;
    }
  }
}
