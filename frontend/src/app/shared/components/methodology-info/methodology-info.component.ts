import { Component, ElementRef, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { InfoIconComponent } from '../../icons';

// Info icon that reveals a small tooltip containing a link to the Methodology
// page — shown on hover (desktop) or tap (mobile). Unlike a plain link, a
// mobile tap opens the tooltip instead of navigating straight to Methodology.
@Component({
  selector: 'app-methodology-info',
  standalone: true,
  imports: [RouterLink, TranslateModule, InfoIconComponent],
  templateUrl: './methodology-info.component.html',
  styles: [':host { display: inline-flex; position: relative; vertical-align: middle; }'],
})
export class MethodologyInfoComponent {
  open = false;
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @HostListener('mouseenter')
  onEnter(): void {
    this.open = true;
  }

  @HostListener('mouseleave')
  onLeave(): void {
    this.open = false;
  }

  // Tap opens (never toggles, so the synthetic mouseenter+click pair a touch
  // tap fires can't immediately re-close it); an outside click dismisses.
  open_(): void {
    this.open = true;
  }

  @HostListener('document:click', ['$event.target'])
  onDocumentClick(target: EventTarget | null): void {
    if (!this.host.nativeElement.contains(target as Node)) this.open = false;
  }
}
