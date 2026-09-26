# Phase 01 - Secure baseline

## Changes made

### 1. Legacy SmartSuite isolation

The following endpoints now return HTTP `410` unless the explicit server-side flag `ENABLE_LEGACY_SMARTSUITE_ROUTES=true` is present:

- `/api/archive-import/import`
- `/api/archive-import/validate`
- `/api/content-review/approve`
- `/api/content-review/list`
- `/api/content-submit/assignment`
- `/api/content-submit`
- `/api/coordinator/campaigns`
- `/api/coordinator/check-influencer`
- `/api/coordinator/login`
- `/api/coordinator/submit-assignment`
- `/api/payments/sync-paid`

Legacy UI paths `/coordinator/*` and `/content-submit` are also blocked by default.

### 2. Reproducible project root

Restored:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `next-env.d.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `proxy.ts`
- `.gitignore`
- `.env.example`

### 3. Verification

`npm run typecheck` passes with zero TypeScript errors.

A complete Linux Next.js build could not be executed in the isolated review container because the uploaded dependency folder includes `@next/swc-win32-x64-msvc`, while Next.js attempted to download the Linux SWC binary and the environment has no npm network access. This is an environment/dependency artifact, not a discovered application compile error. A fresh `npm install` on the deployment target must be followed by `npm run typecheck` and `npm run build`.

## Remaining security work

Phase 01 intentionally does not redesign functional workflows. The next release blocker is registration consent/legal versioning, followed by onboarding workflow consolidation.
