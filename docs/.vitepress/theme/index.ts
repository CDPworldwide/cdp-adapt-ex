import DefaultTheme from "vitepress/theme";
import { inBrowser, type Theme } from "vitepress";
import posthog from "posthog-js";
import "./custom.css";

type DocsPosthogConfig = {
  enabled: boolean;
  key: string;
  host: string;
  uiHost: string;
  sessionReplayEnabled: boolean;
};

declare const __DOCS_POSTHOG__: DocsPosthogConfig;

function isPosthogHostAllowed(hostname: string): boolean {
  return (
    hostname === "cdp-action-explorer.net" ||
    hostname === "cdpworldwide.github.io" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".a.run.app")
  );
}

function capturePageView(): void {
  posthog.capture("$pageview", {
    $current_url: window.location.href,
    path: window.location.pathname,
    search: window.location.search,
    surface: "docs",
  });
}

const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ router }) {
    if (
      !inBrowser ||
      !__DOCS_POSTHOG__.enabled ||
      !__DOCS_POSTHOG__.key ||
      !isPosthogHostAllowed(window.location.hostname)
    ) {
      return;
    }

    posthog.init(__DOCS_POSTHOG__.key, {
      api_host: __DOCS_POSTHOG__.host,
      ui_host: __DOCS_POSTHOG__.uiHost,
      defaults: "2026-01-30",
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: {
        url_allowlist: [
          /^https:\/\/cdp-action-explorer\.net(?:\/.*)?$/,
          /^https:\/\/cdpworldwide\.github\.io\/cdp-adapt-ex(?:\/.*)?$/,
          /^https:\/\/[-a-z0-9]+\.a\.run\.app(?:\/.*)?$/,
          /^https?:\/\/localhost:\d+(?:\/.*)?$/,
          /^https?:\/\/127\.0\.0\.1:\d+(?:\/.*)?$/,
        ],
      },
      disable_session_recording: __DOCS_POSTHOG__.sessionReplayEnabled === false,
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: "*",
        blockSelector: ".sensitive-data, [data-ph-no-capture]",
      },
    });

    capturePageView();
    router.onAfterRouteChanged = () => {
      capturePageView();
    };
  },
};

export default theme;
