# Phase 0 priority API matrix

This is the bounded Phase 0 regression gate. It prioritizes cabin booking,
checkout, staff authorization, receipt/refund accounting, and failure handling in
existing email paths. The [baseline](baseline.md) records the full existing suites;
[the inventory](inventory.md) assigns later work. No #136 broad dining coverage or
#139 notification features are included.

## HTTP assertions

All cases below execute in [`scripts/http-smoke/run.mjs`](../../scripts/http-smoke/run.mjs)
through actual Next routing/proxies, real Clerk SDK verification of locally signed
sessions, and disposable MongoDB. Stripe/Resend operations and Clerk's backend are
controlled fixtures. See [setup and boundaries](http-smoke.md).

| App / route / method                          | Success and observable effects                                                                                                                                                                          | Denial/failure and negative effects                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer `GET /api/cabins`                    | Public JSON contains the persisted active cabin.                                                                                                                                                        | A real MongoDB `find` failpoint produces safe 500 JSON, leaves the cabin intact and makes no provider call.                                                                                                                         |
| Customer `POST /api/bookings`                 | Creates one booking for the verified customer, calculates total 300 and deposit due 75 from server data, stores no receipts. Client-supplied customer/price cannot override these.                      | Missing/expired/tampered sessions redirect to the expected Clerk sign-in endpoint and create nothing; invalid guest count returns 400 with no write; overlap returns 409 without a second booking.                                  |
| Customer `GET /api/bookings/[id]`             | Own booking is serialized with the matching identifier.                                                                                                                                                 | Foreign booking returns safe 404 without mutation.                                                                                                                                                                                  |
| Customer `PATCH /api/bookings/[id]`           | Allowed guest update persists; injected total price is ignored.                                                                                                                                         | Foreign update returns 404 with an unchanged complete row snapshot.                                                                                                                                                                 |
| Customer `POST /api/payments/create-checkout` | Stores a quote, converts 75 major units to 7500 cents, uses the customer production return origin; retry reuses one session and the same quote/idempotency key.                                         | #135 foreign and missing identifiers return identical exact 404 bodies with no provider call or write. Injected Stripe failure returns safe 500, retains the retryable quote, and records no receipt.                               |
| Customer `POST /api/payments/webhook`         | A real signed paid event persists one receipt; same-event and different-event duplicate delivery do not add receipts. Signed refund completion persists refunded amount; older events cannot reduce it. | Invalid signature returns 400 before settlement. Email provider failure after payment does not erase the receipt or set a successful-delivery timestamp. The 200 acknowledges durable payment handling, not email delivery.         |
| Customer `DELETE /api/bookings/[id]`          | Cancels and persists refund intent capped at received money (75, not the 300 booking total); recovered provider retry uses the same idempotency key; repeat cancellation does not issue another refund. | Foreign cancellation returns 404 without writes or refund calls. Provider failure preserves cancellation plus explicitly pending refund/error in the existing 200 envelope; completed refund remains zero until the signed webhook. |
| Customer `POST /api/send/confirm`             | Provider recovery returns the provider message ID for the authenticated customer's email.                                                                                                               | Foreign confirmation returns the existing 403 and makes no provider call. Resend failure returns 500; booking snapshot is unchanged. This legacy 403 is intentionally distinct from checkout's #135 404 contract.                   |
| Customer `POST /api/send/payment-confirm`     | Existing paid receipt permits delivery to the authenticated customer; success returns message ID.                                                                                                       | Resend failure returns 500; retry succeeds; persisted receipts are unchanged.                                                                                                                                                       |
| Customer `POST /api/send/welcome`             | Sends only to the verified current user's fixture email, returns message ID.                                                                                                                            | Resend failure returns 500; retry succeeds without booking mutations.                                                                                                                                                               |
| Admin `GET /api/settings`                     | Front-desk assignment with current membership reads persisted settings.                                                                                                                                 | Missing session redirects to sign-in. Wrong organization, no assignment, revoked membership and live membership removal return 403.                                                                                                 |
| Admin `PUT /api/settings`                     | Application administrator updates the field and records one audit with exact actor, application role, organization and before/after field values.                                                       | Front desk receives 403 with an unchanged settings snapshot. Clerk's token role remains `org:member`; application permissions come from MongoDB.                                                                                    |
| Admin `POST /api/send/confirm`                | Authorized staff path returns provider message ID for the requested fixture recipient.                                                                                                                  | Unassigned user returns 403 with no provider call; Resend failure returns 500; retry succeeds.                                                                                                                                      |
| Admin `POST /api/send/welcome`                | Application administrator receives a provider success message ID.                                                                                                                                       | Unassigned user returns 403 with no send; Resend failure returns 500; retry succeeds.                                                                                                                                               |

The failpoint is enabled only on the disposable MongoDB process. It does not alter
application connection code. Expected retry-state writes (checkout quote and
cancellation refund plan) are asserted explicitly instead of incorrectly claiming
that every failed provider request must perform zero writes.

The HTTP helper's negative tests also launch child processes that must exit 1 for
injected status failures, timeouts and incorrect success bodies. HTML, malformed
JSON, unexpected redirects and body-stream timeouts are rejected separately. This
proves failures reach the CI exit status instead of merely printing a warning.

## Existing priority regressions reused

| Test source                                                                                                                        | Contracts protected                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`packages/database/tests/payments.test.ts`](../../packages/database/tests/payments.test.ts)                                       | Deposit obligation versus receipts; identical/mismatched retries; overpayment rejection; concurrent overlapping requests; customer ownership/capacity/pricing and paid/pending repricing guards; concurrent duplicate Stripe deliveries; optimistic offline payment writes.      |
| [`packages/database/tests/reservation-payments.test.ts`](../../packages/database/tests/reservation-payments.test.ts)               | Existing shared receipt and refund state: partial payments, retry identity, tender limits, full refunds, concurrent overcollection prevention, legacy paid records, pending checkout/refund guards, quote checks and checkout recovery. Reuse this suite without expanding #136. |
| [`apps/admin/__tests__/integration/api/bookings-patch.test.ts`](../../apps/admin/__tests__/integration/api/bookings-patch.test.ts) | Manual receipt persistence, full/partial payment, overpayment with unchanged receipts, invalid status transitions, cancellation/refund field restrictions, invalid/missing resources.                                                                                            |
| [`apps/admin/__tests__/integration/api/staff-access.test.ts`](../../apps/admin/__tests__/integration/api/staff-access.test.ts)     | Current organization membership plus local assignment, fail-closed membership lookup, permission matrix independent of Clerk role, assignment/revocation, self-change rejection, reciprocal-admin concurrency and denied refund writes.                                          |
| [`apps/customer/__tests__/api/payment-webhook.test.ts`](../../apps/customer/__tests__/api/payment-webhook.test.ts)                 | Real signed payload verification with mocked domain dependencies; failed database settlement remains retryable, unpaid events cannot settle, old refund events cannot reduce amounts, reservation accounting dispatch and confirmation retry behavior.                           |
| [`apps/admin/__tests__/integration/api/settings.test.ts`](../../apps/admin/__tests__/integration/api/settings.test.ts)             | Settings validation and persistence. Use alongside HTTP authorization/audit evidence, not as proof of hosted Clerk verification.                                                                                                                                                 |

## Deliberate remaining boundaries

These are follow-up test additions before touching the corresponding slice, not
claims that every endpoint is now covered:

- **Phase 1 cabin boundary slice:** expand each customer detail method's full
  invalid-ID, missing-resource, database-error and auth permutations; characterize
  calendar-date serialization and populated-reference absence. Existing domain
  tests protect capacity/paid-quote rules while route coverage grows with the slice.
- **Phase 2 permissions/validation slice:** expand the HTTP role matrix from the
  representative settings/email operations to all mutation routes; preserve
  existing staff integration tests and fail-closed behavior.
- **Phase 3 accounting slice:** keep the existing shared concurrency suites and
  add HTTP concurrency for the exact payment/refund operations being changed.
  Local doubles are not proof of Stripe's network or production account behavior.
- **Phase 5 email slice:** existing reservation-confirmation helper failures are
  covered at the webhook dispatch boundary; add direct helper and route tests for
  the sender/configuration changes. Validate live delivery separately under #132.
  No new delivery retries/notifications or broad dining test program are implied.
- **Deployment verification:** hosted Clerk browser login/cookies/session refresh,
  real provider delivery and a named-commit CI workflow result remain distinct
  evidence from a local HTTP pass.

No source behavior was changed to make this initial gate pass. Confirmation
email's legacy response shape and cancellation's pending-refund envelope are
recorded explicitly; future intentional changes need focused regressions.
