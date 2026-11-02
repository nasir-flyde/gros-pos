# POS pause control

POS has its own global, server-persisted availability setting. It defaults to enabled and is independent of Admin availability, storefront SiteConfig, customer/mobile APIs, payment webhooks and jobs. No migration or seed is required.

## Management and identity

Only the current ACTIVE local User record for the authenticated subject can grant maintenance access. The normalized exact emails `nasir@flyde.in` and `samarth@flyde.in` can manage and bypass the POS pause, retaining their existing role, organization and store permissions. Token email claims, headers, request-body identity, aliases and superadmin status do not grant access. The implementation reuses the Admin identity allowlist.

Admin Settings shows separate **Admin site availability** and **POS availability** controls for those two accounts, including the existing settings-only access for managers without `org.read`. POS contains no availability switch. Management uses `GET /api/v1/admin/pos-maintenance` and strict `PUT { "enabled": true|false }` at that path. Neither management endpoint depends on either operational pause; updates still require the authoritative manager identity. Mutations are audited, with `updatedBy` and timestamps in the `PosMaintenance` singleton (`_id: pos-panel`). A missing document uses `POS_PANEL_INITIAL_ENABLED`, default `true`; reads never create a document. Saved values take precedence.

## Server and client boundaries

`GET /api/v1/pos/maintenance` is the read-only status/recovery endpoint. It returns `{ enabled, canBypass, canManage, updatedAt }` in the normal `data` envelope for active authenticated users. Mutation at this POS path returns 405.

Every `/api/v1/pos/*` operational request enforces persisted availability before its business handlers. A blocked request returns 503 with `POS_PAUSED` and `Cache-Control: no-store`. Existing POS checkout, quote, stock, catalog and terminal endpoints retain their URLs and permissions. The POS client maps shared operational resources (customers, orders, inventory, uploads, etc.) into this namespace; delegated shared handlers retain existing tenancy, scope, role checks and resource audit records. Unknown resources cannot enter the namespace. Auth bootstrap remains `GET /api/v1/auth/me`.

Deploy the backend before the frontends. Leave the configured API base URL at `/api/v1`. The POS frontend fails closed until both session resolution and a successful availability read. A pause unmounts business pages, stops their polling, cancels/clears query cache and aborts tracked Axios/catalog/direct-upload requests. New dispatches, including those waiting on a Clerk token, refuse access. Direct catalog fetches recognize the specific pause code and cannot return the offline cache or fall back to shared APIs after pause/cancellation. A status/network error gates POS with a separate availability error; ordinary business failures do not activate maintenance.

The blocking popup uses the existing Admin wording:

> **Could Not Load Information**
>
> The system is not able to load information. Please contact support if the issue persists.

There is at most one status read in flight, a 10-second timeout, no automatic status retries, a visible-tab check every 60 seconds, and a five-second manual/focus cooldown. Hidden tabs check when visible again. Re-enabling recovers on the next status check without refreshing or resubmitting financial writes. The two approved accounts retain authorized business access during a pause.

## Sessions and interrupted checkout

Account/session changes abort old bootstrap/status/business requests and clear permission/query/catalog state. Cart and last-receipt storage are cleared on an account change; a same-account pause retains the existing cart. Unowned legacy cart storage is cleared once when establishing the first explicit account owner, because it cannot be safely attributed. A late old-account response cannot restore bypass/access.

Checkout and Paytm request dispatches create a per-account sessionStorage transaction guard before sending, and supply an `Idempotency-Key` (normal checkout already supports server idempotency). A pause rejects before new business writes. A transaction already admitted may finish despite browser cancellation. Cancellation, transport errors and server errors retain an unresolved guard across pause, route remount and browser reload; the client refuses another checkout/payment dispatch until the cashier verifies Orders and the payment provider and explicitly acknowledges that verification. A definite server rejection releases the guard. There is no automatic write replay. Accepted Paytm transaction IDs are retained and reopen with polling stopped; explicit status checking resumes the existing transaction rather than sending a new payment request. A definitive payment completion/failure releases its guard. Session storage failure prevents a financial request before dispatch.

This is a protection against accidental replay in the same browser tab, not a new global financial transaction protocol. Browser cancellation cannot undo a server write. The existing backend checkout idempotency/transaction guarantees still apply; transaction resolution after an ambiguous failure needs operator verification. The inspected backend currently does not implement the Paytm routes referenced by the preexisting POS frontend; this change does not add those payment integrations. Their pause/client-guard behavior is tested with isolated adapters only.

## Security limits

Unprefixed shared APIs retain their existing authorization for other consumers. An authorized caller can still call a shared route directly; client gating does not secure those generic APIs. Universal app-specific revocation requires server-verified app credentials/audiences or API separation. A global shared-route pause would also interrupt storefront/mobile and is intentionally outside this feature. Existing POS-specific `/pos/*` endpoints are enforced on the server, including consumers traversing the shared router.

No live settings are changed by implementation or verification. No accounts, roles, orders, real payments, production database writes, push or deployment are required.

## Safe verification

Run in an isolated checkout without production `.env` files. Backend integration setup creates disposable MongoDB fixtures:

```sh
npm test -- --runTestsByPath tests/integration/posMaintenance.test.js tests/integration/adminMaintenance.test.js tests/integration/auth.test.js tests/unit/authMiddleware.test.js tests/unit/tenantMiddleware.test.js tests/integration/orders-pos-refunds.test.js tests/integration/idempotency-concurrency.test.js tests/unit/idempotencyMiddleware.test.js tests/unit/orderCheckoutSecurity.test.js
npm run lint
```

POS:

```sh
npm test -- --maxWorkers=2 src/lib/pos-maintenance.test.ts src/lib/pos-transaction-guard.test.ts src/components/pos-maintenance-gate.test.tsx src/components/auth-provider.test.tsx src/lib/product-api.test.ts
npm run typecheck
npm run lint
npm run build
```

Admin: `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. The baseline Admin checkout already contains unrelated TypeScript failures; compare baseline diagnostics before attributing them to this feature.
