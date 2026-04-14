import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CdpLogoWithTextIconComponent } from '../icons';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatMenuModule,
    RouterLink,
    TranslateModule,
    CdpLogoWithTextIconComponent,
  ],
  templateUrl: './app-header.html',
})
export class AppHeaderComponent {
  @Input() showMenuButton = false;
  @Input() menuExpanded = false;
  @Input() menuControlsId: string | null = null;

  @Output() menuToggle = new EventEmitter<void>();

  readonly languageService = inject(LanguageService);

  onMenuToggle(): void {
    this.menuToggle.emit();
  }
}
