import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import type { LocationProfile } from '@pac-api/client';
import { distinctUntilChanged, map, switchMap, of, catchError } from 'rxjs';
import { environment } from '@env/environment';
import { AppHeaderComponent } from '../../shared/app-header/app-header';
import { LocationService } from '../../shared/services/location.service';
import { MobileKeyboardViewportService } from '../../shared/services/mobile-keyboard-viewport.service';
import { AskCdpAiComponent } from '../ask-cdp-ai/ask-cdp-ai.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [AppHeaderComponent, AskCdpAiComponent, TranslateModule],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.css',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class ChatPageComponent implements OnInit {
  locationData: LocationProfile | null = null;
  readonly showLocalTestControls = !environment.production;

  private readonly destroyRef = inject(DestroyRef);
  private readonly locationService = inject(LocationService);
  private readonly mobileKeyboardViewportService = inject(MobileKeyboardViewportService);
  private readonly route = inject(ActivatedRoute);

  ngOnInit(): void {
    this.mobileKeyboardViewportService.startTracking(this.destroyRef);

    this.route.queryParamMap
      .pipe(
        map((queryParams) => queryParams.get('organizationId')),
        distinctUntilChanged(),
        switchMap((organizationId) => {
          if (!organizationId) {
            return of(null);
          }

          return this.locationService.getLocationByOrganizationId(organizationId).pipe(
            catchError(() => {
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((locationData) => {
        this.locationData = locationData;
      });
  }
}
