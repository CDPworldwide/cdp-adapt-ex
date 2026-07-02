import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class WelcomeModalService {
  private readonly isOpenState = signal(false);

  readonly isOpen = this.isOpenState.asReadonly();

  open(): void {
    this.isOpenState.set(true);
  }

  close(): void {
    this.isOpenState.set(false);
  }
}
