# Markdown & Damage Portal — Store POS Implementation Plan

## 1. Scope

Add a permission-controlled **Markdown & Damage Portal** to Store POS for creating and tracking Near Expiry and Damaged/Dump requests. Preserve and extend the existing dynamic-label scan and checkout flow.

Backend contract and inventory rules are defined in `../../chota-bazaar-backend/docs/markdown-damage-approval-implementation-plan.md`.

## 2. Existing functionality to retain

- Dynamic markdown resolution in `src/lib/markdown-api.ts`
- Markdown scanning in `src/routes/_pos.scanner.tsx` and `src/routes/_pos.new-order.tsx`
- Checkout revalidation in `src/routes/_pos.checkout.tsx`
- Markdown data in cart and receipts

New labels use `BATCH-MKD-*`; existing `MD...` labels must remain scannable.

## 3. Navigation and access

Add a side-navigation item:

```text
Markdown & Damage
```

Proposed route:

```text
/markdown-damage
```

Display only when the user is a super admin or has `inventory.markdownRequest.create`/`inventory.markdownRequest.read`. The backend remains responsible for store-scope enforcement.

The page uses the single store from `StoreScopeGate`; do not let ordinary store users submit for another store.

## 4. Page structure

Use three sections:

1. **Near Expiry** request form
2. **Damaged / Dump** request form
3. **My Requests** status/history

### Near Expiry fields

- Base EAN scan/manual input
- Read-only product name and SKU
- Read-only MRP/current normal price
- Batch selector when multiple batches match
- Read-only current eligible batch/system stock
- Requested quantity
- Proposed markdown price
- Expiry date calendar
- Mandatory proof photo

The batch expiry returned by the backend is authoritative. Pre-fill the calendar from the selected batch and prevent submission if the entered date differs.

### Damaged / Dump fields

- Base EAN scan/manual input
- Product/SKU/MRP/stock and batch selection
- Requested quantity
- Proposed markdown price; `0` clearly displays **Total dump — no sale barcode will be generated**
- Damage type dropdown populated from the agreed backend enum/configuration
- Mandatory physical-damage photo

## 5. EAN and batch flow

1. Normalize scanner input.
2. Reject values matching either dynamic label format; this form accepts only a base EAN.
3. Call `GET /inventory/markdown-portal/request-scan` with scoped store and EAN.
4. Show returned product and eligible batches.
5. Require explicit batch selection when more than one batch is returned.
6. Reset quantity, date, and stale product details if EAN or batch changes.

Do not calculate system stock from the locally cached POS catalog. Use the request-scan response because approval inventory is batch-specific.

## 6. Proof photo upload

Create a reusable proof uploader that:

- accepts camera capture (`capture="environment"`) and file selection
- accepts JPEG/PNG/WebP only
- validates the agreed size limit before upload
- previews the selected image
- supports remove/replace before submit
- uploads through the backend direct-upload flow with category `MARKDOWN_DAMAGE_PROOF`
- marks the form complete only after backend upload completion
- never stores image bytes in local/session storage

Show retry state for upload failures. Submit `proofAssetId`, not an arbitrary URL.

## 7. Validation and submission UX

Perform client validation for quick feedback while treating backend errors as authoritative:

- positive integer quantity
- quantity no greater than displayed eligible stock
- proposed price from `0` through normal price
- expiry date and proof required for Near Expiry
- damage type and proof required for Damaged/Dump

Submission sequence:

1. Create or update draft.
2. Upload/associate completed proof.
3. Submit request using an idempotency key.
4. On success, clear the form and show request number/status.
5. Refresh request history and live inventory/catalog caches.

Disable duplicate submit while pending. If stock changed, display the backend message and refresh the scan result rather than silently changing quantity.

## 8. Request history

Show store-scoped requests with:

- request number and date
- type and product/SKU
- requested quantity and proposed price
- `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, or `CANCELLED`
- rejection reason
- approved barcode and remaining quota where applicable
- dump completion/write-off reference

Actions:

- Draft: edit, cancel, submit
- Submitted: view only (unless backend policy allows cancellation)
- Approved markdown: download/print label
- Rejected: view mandatory reason; offer “Create corrected request” by copying safe form fields but require a new proof check

## 9. Label printing

For an approved markdown request:

- call `GET /inventory/markdown-portal/requests/:id/label`
- download/open the backend-generated PDF
- show approved price, approved quantity, expiry, and code
- include an operational reminder to print only the approved number of labels and place each sticker over the original EAN

No print action is shown for a zero-price dump.

## 10. Scanner and checkout changes

Update `src/lib/markdown-api.ts`:

- recognize both `/^MD[A-F0-9]{20}$/i` and the new `BATCH-MKD-*` format
- add request API types and calls
- map `MARKDOWN_EXHAUSTED` to the exact visible message **Markdown Qty Exhausted**

Keep current behavior:

- resolve label against the scoped store
- build cart line from server-approved price
- disallow markdown labels on held/delivery/manual-discount flows
- re-resolve at checkout

Add local cart protection so quantity for a markdown code cannot exceed `remainingQuantity`. This is convenience only; backend checkout remains the hard cap across terminals.

When checkout returns `MARKDOWN_EXHAUSTED`, keep the cart safe, identify the affected line, show the error prominently, and allow removal/rescan. Never fall back to normal SKU pricing automatically.

## 11. State and API files

Suggested changes:

- Extend `src/lib/markdown-api.ts`
- Add `src/lib/markdown-request-api.ts` if request concerns make the existing file too large
- Add `src/routes/_pos.markdown-damage.tsx`
- Add focused form/photo/status components under `src/components/markdown-damage/`
- Update `src/routes/_pos.tsx` navigation and permission filtering
- Regenerate `src/routeTree.gen.ts` through the normal TanStack route process; do not hand-maintain generated code

## 12. Tests

### Unit/component

- navigation permission visibility
- Near Expiry mandatory expiry/photo
- Damage mandatory type/photo
- quantity and price bounds
- multiple-batch selection
- zero-price dump explanation and no label action
- upload success/failure/retry
- request statuses and rejection reason
- both legacy and new barcode recognition
- exact exhausted message

### Integration/UI flow

- scan EAN -> select batch -> upload -> submit
- duplicate clicks create one request
- stale stock response refreshes form
- approved request label download
- rejected request reason display
- new label adds at approved price
- cart cannot exceed returned remaining quota
- checkout exhaustion from another terminal is handled without fallback pricing

Run before merge:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

## 13. Delivery sequence

1. Add API types, barcode backward compatibility, and tests.
2. Add permission-aware navigation and request history shell.
3. Add EAN/batch scan flow.
4. Add proof uploader.
5. Add both forms and draft/submit handling.
6. Add approved-label printing.
7. Complete hard-cap error UX and end-to-end staging test.
8. Enable only after backend migrations/RBAC and Admin approval UI are deployed.

## 14. Gros sync status

A guarded sync workflow maps `nasir-flyde/chota-bazaar-pos` to `nasir-flyde/gros-pos`. Its bootstrap baseline, enable flag, and sync credential are configured. After the workflow files reach source `main`, each application push creates or updates a manual-review `sync/chota-bazaar` PR against Gros POS `main`; it never auto-merges. Source CI/deployment files and environment artifacts are excluded.
