import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { LocationPin } from '@pac-api/client';

@Injectable({
  providedIn: 'root',
})
export class MapSelectionService {
  private selectedMapLocationSubject = new BehaviorSubject<LocationPin | null>(null);
  public selectedMapLocation$ = this.selectedMapLocationSubject.asObservable();

  private isMapClickedSubject = new BehaviorSubject<boolean>(false);
  public isMapClicked$ = this.isMapClickedSubject.asObservable();

  selectLocation(location: LocationPin): void {
    this.selectedMapLocationSubject.next(location);
    this.setMapClicked(true);
  }

  clearSelection(): void {
    this.selectedMapLocationSubject.next(null);
  }

  getSelectedLocation(): LocationPin | null {
    return this.selectedMapLocationSubject.value;
  }

  setMapClicked(isClicked: boolean): void {
    this.isMapClickedSubject.next(isClicked);
  }
}
