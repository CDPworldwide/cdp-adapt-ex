import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, CommonModule, RouterModule, TranslateModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  // Navigation items
  navItems = [
    { path: '/app/main', labelKey: 'shared.legacyNav.main' },
    { path: '/app/maps', labelKey: 'shared.legacyNav.maps' },
    { path: '/app/chat', labelKey: 'shared.legacyNav.chat' },
  ];
}
