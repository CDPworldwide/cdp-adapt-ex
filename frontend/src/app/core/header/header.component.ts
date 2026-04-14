import { Component, inject, DestroyRef, computed } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { SessionService } from '../login-session/session.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule, MatIconModule, CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  // Use reactive computed signals that automatically update
  sessionId = this.sessionService.sessionId;
  isLoggedIn = this.authService.isLoggedIn;

  // Navigation items
  navItems = [
    { path: '/app/main', label: 'Main' },
    { path: '/app/maps', label: 'Maps' },
    { path: '/app/chat', label: 'Chat' },
  ];
  // Computed truncated session ID (first 6 + last 6 characters)
  truncatedSessionId = computed(() => {
    const id = this.sessionId();
    if (!id || id.length <= 12) return id;
    return `${id.substring(0, 6)}...${id.substring(id.length - 6)}`;
  });

  logOut() {
    this.authService.logout();
  }

  createNewSession() {
    const subscription = this.sessionService.createSession().subscribe({
      next: (response) => {
        this.router.navigate(['/app/maps']);
      },
      error: (error: Error) => {
        console.error('Error creating session:', error);
      },
    });
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }
}
