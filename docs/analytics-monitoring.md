# Analytics Monitoring

PostHog project: `141282`

Primary dashboard: `CDP Action Explorer - Health`

The Web Analytics installation health page should remain at `6 of 6 checks passed`.
Production analytics should only be authorized for and emitted from:

- `https://cdp-action-explorer.net`

Do not authorize raw Cloud Run service URLs unless there is an intentional public entry point that should appear in production analytics.

## Alerts

Attach PostHog alerts to the existing trend insights on `CDP Action Explorer - Health`.

| Signal | Insight | Alert condition | Action |
| --- | --- | --- | --- |
| Pageviews | `Pageview health` | Anomaly detection or daily count drops below the recent baseline | Check production deployment, PostHog key/env vars, and `/_cdp` proxy availability. |
| Pageleave | Add or maintain a `$pageleave` trend tile | Daily count drops to `0` or falls sharply against `$pageview` | Check `capture_pageleave: true`, release status, and browser unload/navigation behavior. |
| Click/autocapture | `Click health` | Daily autocapture count drops to `0` | Check PostHog initialization, proxy scripts, and ad-blocker/proxy regressions. |
| Frontend errors | `Frontend errors` | Error count exceeds normal baseline | Triage in Sentry first, then correlate sessions in PostHog. |
| Web vitals | Web Analytics `Web vitals` | INP, LCP, FCP, or CLS moves into poor range for a sustained period | Investigate route-level breakdowns, especially `/org/...` pages. |

## Verification

After each frontend production deploy:

1. Confirm `https://cdp-action-explorer.net/_cdp/array/<project-key>/config.js` returns `200`.
2. Confirm the deployed bundle contains `host: "/_cdp"` and `capture_pageleave: true`.
3. Open the PostHog Web Analytics health page and verify `6 of 6 checks passed`.
4. Confirm raw Cloud Run URLs are not added to Web Analytics authorized domains.
