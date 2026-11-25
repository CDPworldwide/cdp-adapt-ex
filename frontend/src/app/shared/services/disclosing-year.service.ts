import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DisclosingYearService {
  private readonly disclosingYearSubject = new BehaviorSubject<number>(2026);

  readonly disclosingYear$ = this.disclosingYearSubject.asObservable();

  get disclosingYear(): number {
    return this.disclosingYearSubject.value;
  }

  setDisclosingYear(year: number): void {
    this.disclosingYearSubject.next(year);
  }
}
