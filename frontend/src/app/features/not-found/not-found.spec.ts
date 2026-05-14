import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';

import { NotFound } from './not-found';

@Component({
  standalone: true,
  template: '',
})
class DummyHomeComponent {}

describe('NotFound', () => {
  let harness: RouterTestingHarness;
  let component: NotFound;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound, TranslateModule.forRoot()],
      providers: [
        provideRouter([
          { path: '', component: DummyHomeComponent },
          { path: 'not-found', component: NotFound },
        ]),
      ],
    }).compileComponents();

    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    component = await harness.navigateByUrl('/not-found', NotFound);
  });

  it('should navigate to the home page when the link is clicked', async () => {
    const link = harness.routeNativeElement?.querySelector('a') as HTMLAnchorElement;
    link.click();
    await harness.fixture.whenStable();
    expect(router.url).toBe('/');
  });
});
