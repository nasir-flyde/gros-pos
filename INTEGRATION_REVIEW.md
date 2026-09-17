# Gros POS integration review

## Pinned revisions and scope

- Source: `nasir-flyde/chota-bazaar-pos`, main `aea600e0ab4f0626452770b397bf5a144451ed9c` (39 commits after base).
- Destination: `nasir-flyde/gros-pos`, main `7c00c4f7813260c65f8f0ac356b4ca4037f0ea48` (2 commits after base).
- Common base: `3ab9ee401db42687491e2bb719dd3daceed47b68`.
- Both GitHub main revisions were rechecked before delivery.
- Destination branch: `bootstrap/chota-bazaar-sync`. Source automation branch: `automation/gros-pos-sync`.
- Work was isolated in `/private/tmp/gros-pos-bootstrap` and `/private/tmp/chota-pos-sync`; original working folders remain unchanged.

A no-commit merge was used to identify overlapping application changes. Its resolved working tree is delivered as a cumulative application snapshot on the pinned Gros main, not a merge of Chota deployment/history. No environment values, source deployment/workflows, infrastructure, secrets, archives, build output or Bun lock changes are imported. The only destination `.github` addition is bootstrap sync metadata.

## Conflict resolutions and safety review

- Auth combines source retry/error states and request sequencing with Gros organization selection, password setup, and public/protected POS configuration. User/session/organization changes invalidate pending responses. Old resolved identity cannot render during a switch.
- Public config continues to use `/public/pos-config` with `X-Tenant-Host`. Protected config takes precedence; generation guards reject old public/protected responses. Session invalidation clears previous branding immediately.
- Logos, colors, favicon, login and route titles retain tenant branding. Receipts retain backend organization/store information and generic missing-data fallbacks rather than a hard-coded Chota identity.
- Cart storage is scoped by organization, user and store. A scope change remounts the terminal and creates a fresh query cache. Catalog fallback data and inventory queries are also scoped; old unscoped carts are not loaded by the integrated terminal.
- Password setup remains on `/auth/setup-password`. It now uses the guarded access refresh and ignores completion after unmount instead of writing an unguarded `/auth/me` result into shared state.
- Checkout, weighted entry, scanning, caching, shelf labels, pack breakdown, Orders and fulfillment changes are retained.
- `/returns` redirects to `/orders`; navigation uses Orders. The superseded direct-refund screen is removed. The old refund API type remains because operational regression helpers import it, not because the old screen is retained.
- Orders checks `order.read`, `return.read`, and `return.write`, blocks duplicate clicks/pending requests, and reuses an idempotency key for a retry of the same payload. Successful requests block repeat submission while cache refetch completes. Weighted return selection does not exceed purchased quantity.
- POS only requests approval. It does not automatically approve, refund, collect money, exchange or post stock.
- Gros keeps its Vercel target and environment names. Runtime diagnostics no longer impose a `pk_live_` restriction. Source Amplify default and environment-example assumptions were rejected.
- Retained route tests use TanStack's `-` ignored prefix; Vite regenerated the route tree.
- Imported lint-rule suppression was removed. Formatting errors were fixed without disabling rules.

## Verification

Node 22. Tests are bounded to two workers because the original unconstrained run produced machine-resource timeouts. Browser smoke uses headless Chromium with mocked identity/API boundaries, not a live Clerk tenant or deployed payment service.

| Check | Result |
| --- | --- |
| Source baseline npm ci | pass |
| Source baseline tests | 155 pass |
| Source baseline typecheck / build | pass / pass |
| Source baseline lint | fails on pre-existing formatting errors |
| Gros baseline npm ci | fails: committed lockfile missing `lru-cache@11.5.2` |
| Gros baseline after install repair in disposable baseline worktree only | 37 tests pass, 1 pre-existing hard-coded receipt-brand expectation fails; lint fails; typecheck and build pass |
| Integrated npm ci | pass |
| Integrated npm test | 171 pass, 40 files |
| Integrated npm run lint | 0 errors, 7 Fast Refresh warnings |
| Integrated npm run typecheck | pass |
| Integrated npm run build | pass, Vercel output |
| Mocked Chromium browser smoke | 31 pass, 8 files |
| Frontend payload → actual Gros backend contract | 2 integration tests pass on disposable MongoDB |
| Existing Gros return/refund backend regressions | 15 pass |
| Adapted sync lifecycle tests | 25 pass |

Browser coverage includes mocked login and auth, password setup, scanning, checkout, receipt display/printing boundary, cart/store switching and Orders permission/retry/duplicate behavior. It does not claim to verify live Clerk, hardware scanners/printers, production networking or financial-provider behavior.

The contract runner targets backend revision `56556f5644a2d8be69810a0ec57ea14e62bf4be1`. It uses the exact POS create payload and `/returns` routes, verifies tenant/store and permission denial, replays an idempotent request, rejects a second full-quantity request, verifies approval access, and asserts no refund or inventory transaction is created by request/approval. No live payments or refunds are created.

### Reproduce

```sh
npm ci
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:browser
GROS_BACKEND_ROOT=/absolute/path/to/installed/gros-backend-new npm run test:backend-contract
```

The backend-contract command starts disposable MongoDB using backend test setup. It does not use the deployed backend or a production database. Backend dependencies must already be installed. Vitest/Playwright dependencies were aligned to patched Vitest 4.1.11 rather than the vulnerable 4.1.9 browser adapter.

Remaining non-blocking warnings: seven `react-refresh/only-export-components` warnings in shared UI/context exports; build chunk-size and upstream ignored `use client` notices. npm audit reports 9 dependency findings (1 low, 2 moderate, 6 high), requiring a separate reviewed dependency update; no critical findings remain in the installed graph.

## Backend and rollout prerequisites

Deploy/verify the integrated backend before releasing this frontend: tenant-host public POS config and protected site config, password setup, scoped catalog/inventory/conversion/shelf-label endpoints, and approval-based returns with `return.read`, `return.write`, `return.approve` separation and durable idempotency must be available. Stock/financial posting must remain permission checked and transactional. Configure cashier return permissions separately from approver permissions.

1. Review and merge this Gros bootstrap PR, including `.github/sync/chota-bazaar.json`.
2. Review and merge the separate Chota POS automation PR.
3. Separately configure the GitHub App and `GROS_POS_SYNC_*` settings using the source automation guide.
4. Enable sync only after bootstrap metadata is on Gros main. Automation checks for that metadata and otherwise stops.

Sync imports cumulative application patches on one managed `sync/chota-bazaar` branch and manually merged PR. Configuration/auth/checkout/operational modules stay eligible; overlaps stop for review. No App activation, production deployment, DNS change or live transaction is part of these PRs.
