import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth.service';
import { inject } from '@angular/core';
import { environment } from '@env/environment';

export const authGuard: CanActivateFn = (route, state) => {
  if (environment.authDisabled && !environment.production) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  } else {
    router.navigate(['/']);
    return false;
  }
};
