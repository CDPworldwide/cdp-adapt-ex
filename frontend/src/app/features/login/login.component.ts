import { Component, inject, signal, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { LoginService } from './login.service';
import { DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '@env/environment';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './login.html',
  styleUrls: ['../shared-feature-styles.css', './login.css'],
})
export class Login implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  error = signal('');
  isLoading = signal(false);

  ngOnInit() {
    if (environment.authDisabled && !environment.production) {
      this.router.navigate(['/app/main'], { replaceUrl: true });
    }
  }

  form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  loginService = inject(LoginService);

  onSubmit() {
    this.isLoading.set(true);
    const subscription = this.loginService
      .login(this.form.value.email!, this.form.value.password!)
      .subscribe({
        next: (response) => {
          console.log(response);
          this.router.navigate(['/app/main'], {
            replaceUrl: true,
          });
        },
        error: (error: Error) => {
          this.error.set(error.message);
        },
        complete: () => {
          this.isLoading.set(false);
        },
      });

    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
    });
  }
}
