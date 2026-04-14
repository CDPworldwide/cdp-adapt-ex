import { inject, Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);

  // Reactive signals for authentication state
  private tokenSignal = signal<string | null>(localStorage.getItem('token'));

  // Computed signal for login status
  isLoggedIn = computed(() => !!this.tokenSignal());

  // Computed signal for token retrieval
  token = computed(() => this.tokenSignal());

  login(token: string) {
    // TODO: it's odd how the token is re-used,
    // create_session in the api requires the user token
    // but then /chat requires the session token
    localStorage.setItem('token', token);
    localStorage.setItem('userToken', token);
    this.tokenSignal.set(token);
  }

  updateTokenWithSession(newToken: string) {
    // Note: we'll stay have the original userToken available
    localStorage.setItem('token', newToken);
    this.tokenSignal.set(newToken);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userToken');
    this.tokenSignal.set(null);
    this.router.navigate(['/']);
  }

  retrieveToken() {
    // note: this is generally the session token
    // but could, briefly, be the user login token
    return this.tokenSignal();
  }
}
