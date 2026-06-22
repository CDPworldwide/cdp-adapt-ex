import { NavigationError } from '@angular/router';

import { recoverFromChunkLoadError } from './app.config';

describe('recoverFromChunkLoadError', () => {
  const reloadKey = 'cdp:chunk-load-reload';

  afterEach(() => {
    window.sessionStorage.removeItem(reloadKey);
  });

  it('should reload once for a failed dynamic import', () => {
    const reload = jasmine.createSpy('reload');
    const error = new NavigationError(
      1,
      '/',
      new TypeError('Importing a module script failed.'),
    );

    recoverFromChunkLoadError(error, reload);
    recoverFromChunkLoadError(error, reload);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('should ignore non chunk-load navigation errors', () => {
    const reload = jasmine.createSpy('reload');
    const error = new NavigationError(1, '/', new Error('Resolver failed'));

    recoverFromChunkLoadError(error, reload);

    expect(reload).not.toHaveBeenCalled();
  });
});
