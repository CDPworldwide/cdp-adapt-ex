# Client Package

This package is the local TypeScript SDK consumed by the frontend and test suites.

## Source Of Truth

These files are hand-written and should be reviewed like normal source code:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `openapi-ts.config.ts`
- `scripts/generate.sh`
- `scripts/check-generated.sh`

`openapi.json` is the versioned API snapshot. Keep it in Git so API shape changes collapse into one reviewable file instead of many generated files.

## Generated Files

These files are disposable outputs:

- `src/**`
- `dist/**`

They should be produced from `openapi.json`, not edited by hand.

## Commands

Install the client generator dependencies once:

```bash
npm run client:install
```

Regenerate the SDK from the tracked `openapi.json` snapshot:

```bash
npm run client:generate
```

Refresh `openapi.json` from the backend and regenerate the SDK:

```bash
npm run client:refresh
```

Check whether the expected generated files are present:

```bash
npm run client:check
```

## Recommended Workflow

1. Change the backend schema or routes.
2. Run `npm run client:refresh`.
3. Review `client/openapi.json`.
4. Treat the generated `src/**` diff as mechanical.

If the backend did not change, prefer `npm run client:generate` over `npm run client:refresh`.
