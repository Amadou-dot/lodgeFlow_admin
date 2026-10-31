# Phase 5 provider origins and existing email contracts

Status: implemented and locally verified on `refactor/phase5-provider-origins`,
based on `bfe819b`; ready for PR review.
Part of [#150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150).
See the [implementation plan](phase-5-provider-origins-plan.md).

## Audited boundaries

| Boundary                                                                  | Contract                                                                                                                                                                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer `config/site.ts`, metadata, sitemap, robots and JSON-LD          | `getCustomerOrigin()` uses `NEXT_PUBLIC_APP_URL` or `https://lodgeflow.app`.                                                                                                                 |
| Customer cabin checkout                                                   | The same resolver receives the request origin as fallback. Success/cancel paths, session placeholder, booking ID and Stripe idempotency key remain unchanged.                                |
| Customer dining/experience checkout                                       | The same resolver supplies the matching customer confirmation path. Ownership stays in the shared domain operation.                                                                          |
| Admin navigation and authorization redirect                               | Staff links are relative to the admin app; `proxy.ts` resolves `/unauthorized` against that app's request URL. The existing customer-site shortcut explicitly opens `https://lodgeflow.app`. |
| Both apps' `components/EmailTemplates.tsx` and customer cancellation HTML | Existing templates contain no application links. No new links or notification features were added.                                                                                           |
| Both `lib/resend.ts` modules                                              | SDK construction is lazy, requires a nonempty key at first use, can recover after missing configuration, and reuses its successful instance.                                                 |
| Ten existing send sites                                                   | Sender selection remains in `@lodgeflow/email`; defaults, overrides, recipients, templates, triggers and idempotency keys are unchanged.                                                     |

## Origin policy and intentional corrections

`apps/customer/lib/url.ts` retains `normalizeBaseUrl` and adds a lazy
`getCustomerOrigin({ requestOrigin })` resolver. Selection order is explicit
`NEXT_PUBLIC_APP_URL`, optional checkout request origin, then the production
customer origin. Metadata has no request fallback. Hosted checkout should set
its public origin explicitly; the request fallback preserves existing local and
preview behavior and is not a new host allowlist.

Bare hostnames use HTTPS; bare `localhost`, `127.0.0.1` and `[::1]` use HTTP.
Explicit HTTP/HTTPS overrides remain supported. Leading/trailing whitespace and
trailing slashes are normalized; URL parsing canonicalizes the resulting origin.

Explicit empty values, malformed URLs, embedded whitespace/backslashes,
credentials, paths, queries and fragments now throw
`ApplicationOriginConfigurationError` without echoing configuration. A customer
origin cannot use the known `admin.lodgeflow.app` hostname. Previously these
values could produce broken return URLs, and an empty checkout setting silently
fell back to the request URL while metadata treated it differently.

New cabin origins are validated after the existing ownership/payability and
open-session checks but before a quote is reserved. Invalid configuration cannot
freeze a new quote. Retained open sessions remain reusable; provider failures
still retain their quote for idempotent retries. Reservation checkout supplies
`getReturnUrl: () => string` to the shared domain operation, which resolves it
after ownership/payability/open-session checks and before quote writes. This
preserves existing open-session reuse even when new return-URL configuration is
invalid. Unexpected failures now use the existing server logger. HTTP envelopes
and safe error messages are unchanged.

## Evidence and limits

- Before production edits: six customer characterization suites passed 85 tests;
  all three shared sender tests passed.
- New regressions failed 36 cases before fixes: 26 URL/metadata/cabin cases and
  10 dining/experience cases. They exposed invalid-origin acceptance and missing
  unexpected-error logging. Supported origins, ownership and retry behavior had
  passing characterizations throughout.
- Focused validation passes 149 customer tests and 48 admin tests. Both real
  Resend wrappers are exercised without invoking their send methods. The customer
  type check passes separately from Jest.
- Expanded `pnpm test:http` passes with real Next routing, signed local Clerk
  identities, disposable MongoDB and controlled Stripe/Resend transport. It
  verifies exact customer return origins for all three checkout families,
  foreign/missing reservation denial without effects, unchanged unpaid receipts
  and open-session reuse. Existing email rendering, sender classification,
  rejection, webhook durability and delivery-marker retry assertions also pass.
- Final review identified the need to preserve reservation open-session reuse
  under invalid origin configuration. Four route regressions and two real-Mongo
  tests failed before the correction. All 24 reservation route tests and 15
  reservation payment database tests pass afterward, including unchanged quote
  snapshots on validation failure, owner denial and existing-session reuse.
- Final `pnpm ci:check` passes formatting, read-only lint and 2,600 tests: admin
  1,590, customer 911, database 96, email 3. Both app `tsc --noEmit` checks and
  separate strict compilation of the new admin test pass. Database `tsc --noEmit`
  includes its tests. The clean build caught a new test's Mongoose union call;
  narrowing the model before the query fixed it, and its 15 tests, lint and type
  checks passed again. No compiler settings or type escapes were added.
- `pnpm test:http` passes again after the shared-domain review correction.
- `pnpm install --frozen-lockfile` and `pnpm build` pass in a clean `/tmp` source
  copy with no app/provider/database credentials and CI's throwaway public Clerk
  key. The offline install initially lacked Husky; the frozen online install
  succeeded with the existing optional sharp source-build warning. Sandboxed
  builds could not fetch existing Google fonts; approved network-enabled builds
  succeeded. Existing static-generation/absent-database diagnostics remain.
- Fresh independent review checked URL canonicalization and adjacent callers.
  Its reservation-boundary concern was corrected with the failing-before/passing-
  after tests above. `git diff --check`, root formatting, explicit new-document
  formatting and all 24 local Markdown links pass. Remote CI/previews belong to
  the PR; these local results do not claim merge or deployment.

The sender repair and separately authorized delivery/inbox evidence in #155/#132
remain historical evidence; this slice sends no live email and performs no live
payment or database mutation. Hosted login and full browser workflows were not
rerun. Phase 4 browser acceptance and Phase 6 remain open. #136/#139 stay excluded.
