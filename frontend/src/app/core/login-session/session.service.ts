import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { SessionResponse } from './login-session.model';
import { tap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root',
})
export class SessionService {
  private httpClient = inject(HttpClient);
  private authService = inject(AuthService);

  // Reactive signal for session ID
  private sessionIdSignal = signal<string | null>(localStorage.getItem('token'));

  // Computed signal to expose session ID
  sessionId = computed(() => this.sessionIdSignal());

  createSession() {
    // TODO again, I don't love this
    console.log(
      'updating token from: ' +
        localStorage.getItem('token') +
        ' to ' +
        localStorage.getItem('userToken'),
    );
    localStorage.setItem('token', localStorage.getItem('userToken')!);

    return this.httpClient
      .post<SessionResponse>(`${environment.baseUrl}/api/v1/auth/session`, {})
      .pipe(
        tap((sessionResponse) => {
          localStorage.setItem('token', sessionResponse.token.access_token);
          console.log('Setting token to ' + localStorage.getItem('token'));
          // Update both session ID and auth token signals
          this.sessionIdSignal.set(sessionResponse.session_id);
          this.authService.updateTokenWithSession(sessionResponse.token.access_token);
        }),
      );
  }
}
