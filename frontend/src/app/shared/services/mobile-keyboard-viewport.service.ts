import { DestroyRef, Injectable } from '@angular/core';

type ViewportListenerTarget = Window | VisualViewport;

@Injectable({
  providedIn: 'root',
})
export class MobileKeyboardViewportService {
  private cleanupCallbacks: Array<() => void> = [];
  private frameId: number | null = null;
  private started = false;

  startTracking(destroyRef?: DestroyRef): void {
    if (this.started || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.started = true;
    this.updateViewportVars();

    const visualViewport = window.visualViewport;
    this.addViewportListener(window, 'resize');
    this.addViewportListener(window, 'orientationchange');
    if (visualViewport) {
      this.addViewportListener(visualViewport, 'resize');
      this.addViewportListener(visualViewport, 'scroll');
    }

    destroyRef?.onDestroy(() => this.stopTracking());
  }

  stopTracking(): void {
    if (!this.started) {
      return;
    }

    this.started = false;
    this.cleanupCallbacks.forEach((cleanup) => cleanup());
    this.cleanupCallbacks = [];

    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    const rootStyle = document.documentElement.style;
    rootStyle.removeProperty('--app-visual-viewport-height');
    rootStyle.removeProperty('--app-visual-viewport-offset-top');
    rootStyle.removeProperty('--app-keyboard-inset-bottom');
    rootStyle.removeProperty('--app-keyboard-open');
  }

  keepElementVisible(element: HTMLElement): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    this.updateViewportVars();

    [0, 80, 180, 320].forEach((delay) => {
      window.setTimeout(() => {
        if (document.activeElement !== element) {
          return;
        }

        this.updateViewportVars();
        this.scrollElementIntoVisualViewport(element);
      }, delay);
    });
  }

  private addViewportListener(target: ViewportListenerTarget, eventName: string): void {
    const listener = () => this.scheduleViewportUpdate();
    target.addEventListener(eventName, listener);
    this.cleanupCallbacks.push(() => target.removeEventListener(eventName, listener));
  }

  private scheduleViewportUpdate(): void {
    if (this.frameId !== null) {
      return;
    }

    this.frameId = window.requestAnimationFrame(() => {
      this.frameId = null;
      this.updateViewportVars();
    });
  }

  private updateViewportVars(): void {
    const visualViewport = window.visualViewport;
    const visualViewportHeight = visualViewport?.height ?? window.innerHeight;
    const visualViewportOffsetTop = visualViewport?.offsetTop ?? 0;
    const keyboardInsetBottom = Math.max(
      0,
      window.innerHeight - visualViewportHeight - visualViewportOffsetTop,
    );
    const keyboardOpen = keyboardInsetBottom > 80 ? 1 : 0;
    const rootStyle = document.documentElement.style;

    rootStyle.setProperty('--app-visual-viewport-height', `${visualViewportHeight}px`);
    rootStyle.setProperty('--app-visual-viewport-offset-top', `${visualViewportOffsetTop}px`);
    rootStyle.setProperty('--app-keyboard-inset-bottom', `${keyboardInsetBottom}px`);
    rootStyle.setProperty('--app-keyboard-open', `${keyboardOpen}`);
  }

  private scrollElementIntoVisualViewport(element: HTMLElement): void {
    const visualViewport = window.visualViewport;
    const visibleTop = visualViewport?.offsetTop ?? 0;
    const visibleBottom = visibleTop + (visualViewport?.height ?? window.innerHeight);
    const rect = element.getBoundingClientRect();
    const bottomPadding = 16;

    if (rect.top >= visibleTop && rect.bottom <= visibleBottom - bottomPadding) {
      return;
    }

    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}
