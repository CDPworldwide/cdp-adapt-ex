import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import posthog from 'posthog-js';

import { PosthogService } from './posthog.service';

describe('PosthogService', () => {
  let service: PosthogService;
  let captureSpy: jasmine.Spy;

  beforeEach(() => {
    localStorage.clear();
    captureSpy = spyOn(posthog, 'capture');

    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });

    service = TestBed.inject(PosthogService);
    (service as unknown as { initialized: boolean }).initialized = true;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('adds the stored user type to captured events', () => {
    localStorage.setItem('cdp-user-role', 'ngo');

    service.capture('search_location_selected', { location_name: 'Athens' });

    expect(captureSpy).toHaveBeenCalledWith('search_location_selected', {
      location_name: 'Athens',
      user_type: 'ngo',
    });
  });

  it('does not override an explicit user type on captured events', () => {
    localStorage.setItem('cdp-user-role', 'ngo');

    service.capture('user_role_selected', { user_type: 'business' });

    expect(captureSpy).toHaveBeenCalledWith('user_role_selected', { user_type: 'business' });
  });
});
