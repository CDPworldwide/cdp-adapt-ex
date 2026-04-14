import { HttpClient } from '@angular/common/http';
import { inject, Injectable, DestroyRef } from '@angular/core';
import { environment } from '@env/environment';
import type { LoginResponse } from '../../core/login-session/login-session.model';
import { tap } from 'rxjs';
import { SessionService } from '../../core/login-session/session.service';
import { AuthService } from '../../core/auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private httpClient = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  // The app currently require a session ID to be created to do anything
  // with the graph. So we inject our session service and immediately call it
  private sessionService = inject(SessionService);
  private authService = inject(AuthService);

  login(username: string, password: string) {
    // Create URLSearchParams for form data
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('grant_type', 'password');

    return this.httpClient
      .post<LoginResponse>(`${environment.baseUrl}/api/v1/auth/login`, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      })
      .pipe(
        tap((loginResponse) => {
          this.authService.login(loginResponse.access_token);
          // We need to immediately call the session service, which will
          // update our localStorage with a new token
          // TODO: not sure this is the right pattern
          const subscription = this.sessionService.createSession().subscribe({
            error: (error: Error) => {
              console.error('Error getting session:', error);
            },
          });
          this.destroyRef.onDestroy(() => {
            subscription.unsubscribe();
          });
        }),
      );
  }
}
