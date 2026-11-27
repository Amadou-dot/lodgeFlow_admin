# Remaining Phase 4 functional fixes implementation plan

This plan records the work delivered in [PR #207](https://github.com/Amadou-dot/lodgeFlow_admin/pull/207)
at `5aa48de`. The [acceptance matrix](phase-4-browser-review.md#remaining-browser-and-payment-acceptance)
lists the remaining browser and payment checks.

> **For agentic workers:** Use `superpowers:subagent-driven-development` task by task. Implement only the task brief supplied by the controller. Do not spawn other agents.

**Goal:** Finish the reproducible remaining Phase 4 functional fixes while preserving the established refactor contracts.

**Architecture** Keep the current Next.js, HeroUI, Clerk and cache architecture. Project editable Settings requests, format stay dates at display boundaries, initialize booking forms from loaded records, and constrain existing mobile layouts. Validate the existing checkout response before client side effects.

**Tech Stack:** Node 22, pnpm 11.17.0, TypeScript, Next.js 16, React 18, HeroUI v2, SWR/TanStack Query, Jest, MongoDB/Mongoose.

**Spec** [Agent guide](../../AGENTS.md), [milestone plan](plan.md) and [browser findings](phase-4-browser-review.md). The user authorized the remaining slices on 2026-11-25 after accepting #202 and confirming logout → Back prompts for sign-in. The continuation begins at `b190f44f504db36c0b5a1d0666e366749391dd04`, which includes merge `28bedb6fa0f73df78ff3001d9e8d11ab728f8f18` and the safe Stripe diagnostics. [Diagnostics](../stripe-webhook-diagnostics.md) [PR delivery record](phase-4-browser-fixes-plan.md#delivery-and-browser-scope-2026-11-25)

## Global Constraints

- Preserve observable behavior, API contracts, persisted data, authorization, accounting, and concurrency guarantees except the explicitly documented functional corrections.
- No new features or visual redesign. Browser-test automation infrastructure is deferred by the user; focused characterization/regression tests remain required.
- Preserve payment/active-checkout repricing guards. Never mutate live databases, Settings, Clerk identities, Stripe or email providers.
- No `as unknown as T`, new explicit `any`, disabled compiler/lint rules, or raw-body update spreading. Use named options and explicit browser-safe shapes.
- Calendar stay dates and actual event timestamps are different contracts. Do not rewrite stored timestamps, change stay length, pricing, timezone rules in calculations, or normalize transport values.
- Work only in the isolated continuation worktree. Do not touch the source checkout's `notes.md` or `phase4_browser_sign_off.md`.
- Preserve b190f44's Stripe diagnostics. Source mutations are serial; every task gets a fresh independent review before the next task.
- Use `/tmp/lodgeflow-pnpm` for the Node 22/pnpm 11.17 runner. The isolated worktree has no app-local environment files. Require escalated execution when filesystem/process sandbox rules prevent editing or running disposable tests there.
- Run focused tests while iterating, the affected suite and app types once the task is ready, and strict compiler checks for changed admin tests. The controller owns the final full workspace/HTTP/build gates.
- Commit only the task's files. No push or merge by an implementer. Reports and logs belong in the plan workspace or `/tmp`, not source.

## Review Focus

- A realistic Settings read DTO includes immutable/computed fields and legacy nullable nested values; editing one supported value must still save.
- Edits and reverts made during a pending save/reset must remain drafts after completion and survive a failed request.
- UTC-midnight and non-midnight legacy stay dates must retain their UTC calendar day across negative/positive viewer timezones; actual event times stay local.
- A booking loaded after first render and a selected customer outside the first search page must retain the saved identity without overwriting newer form edits.
- A reduced mobile visual viewport must leave every Dining field reachable; horizontal Calendar scrolling must not obscure narrow-screen dates.

### Task 1: Submit editable Settings changes

**Ownership:** `apps/admin/components/SettingsForm.tsx`, relevant handler types beneath `components/SettingsForm/`, `apps/admin/hooks/useSettings.ts`, focused Settings form/mutation tests. Add a small app-local typed adapter only if needed; do not change the database model, serializer, route permission, server allowlist or response envelope.

**Context** The original form sent its entire AppSettings read DTO. The strict PUT schema rejected `singleton` and `fullAddress`. Untouched `contactInfo: null` was another incompatible read representation. [Original finding](phase-4-browser-review.md#settings-requestresponse-mismatch) [Form regression](../../apps/admin/__tests__/components/SettingsForm.test.tsx)

**Interfaces:** Consume `UpdateSettingsInput` from the existing Settings validation module. The update hook accepts that request shape and returns `AppSettings`. Build a new sparse payload from editable revisioned changes. Successful saves adopt the returned full DTO as the baseline, while retaining changes newer than the submitted revision.

- [x] Add a failing realistic form regression: edit breakfast price on a read DTO containing metadata, singleton, fullAddress and untouched null contactInfo; the submitted body must be exactly the changed editable field and pass the real update schema.
- [x] Pin existing failure/retry/discard and save/reset pending-edit/revert behavior; assert the next save carries the retained edit, and the response rather than the submitted snapshot becomes the server baseline.
- [x] Implement the typed sparse request boundary and migrate the only PUT hook caller. Preserve deep equality, revision tracking, min/max state validation, cache refresh and reset behavior.
- [x] Run Settings component/hooks/cache/validation tests and relevant route tests; run admin types and strict compilation of changed tests. Record RED and GREEN evidence. Format only touched files.
- [x] Update this plan's task checklist and commit the bounded change. Report files, test commands/results, caveats and commit.

### Task 2: Keep cabin stay labels on the intended calendar date

**Ownership:** New `apps/admin/lib/booking-stay-date.ts`; `apps/admin/utils/bookingUtils.ts`; `components/BookingDetails/BookingStatusDates.tsx`; `components/BookingDetails/BookingPDFTemplate.tsx`; `app/(dashboard)/guests/[id]/page.tsx`; `components/EmailTemplates.tsx`; focused date/booking/print/email tests. Do not change calendar occupancy, forms' wire dates, relative status wording, stored dates, calculations or actual event renderers.

**Context** The editor, Calendar and inbox already used UTC date keys. Other absolute stay labels previously formatted UTC-midnight values in the viewer timezone and displayed the preceding day in Denver. [Original finding](phase-4-browser-review.md#stay-dates-and-pdf-entry-point) [Date regressions](../../apps/admin/__tests__/unit/utils/bookingUtils.test.ts)

**Interfaces:** Export `formatBookingStayDate({ date, style })`, accepting only the serialized string and a small union of the existing presentation variants. Use a fixed en-US/UTC calendar formatter and preserve each caller's existing month/day padding and malformed-date fallback. Apply only to planned stay labels. Admin booking confirmation email shares the label formatter for canonical ISO calendar dates and explicitly zoned ISO instants. Its existing permissive input boundary retains prior native local formatting for offset-free date-times and non-ISO legacy forms, without changing accepted inputs or sending behavior.

- [x] Reproduce March 20–23, 2027 displaying a day early in Denver using failing helper/component assertions before implementation.
- [x] Cover UTC midnight, a non-midnight legacy ISO instant, month/year or DST boundary and existing invalid-input fallbacks. Assert unchanged strings/stay lengths and local actual event timestamps.
- [x] Implement the one browser-safe formatting boundary and migrate the inventoried absolute stay-label consumers.
- [x] Run focused tests in separate processes under `TZ=America/Denver`, `TZ=UTC`, `TZ=Asia/Tokyo`; run affected booking/print/email suites, admin types and strict changed-test types. Preserve passing UTC picker/transport coverage.
- [x] Record the display-only behavior correction, format touched files and commit the slice.

### Task 3: Preserve booking edit initialization and selected customer

**Ownership:** Admin booking edit page, `hooks/useBookingForm.ts`, `components/BookingForm/booking-form-data.ts`, customer selection and directly related form types/callers/tests, focused existing admin PUT integration tests, and a verified correction entry in `phase-4-ui-state.md`. [Editor page](<../../apps/admin/app/(dashboard)/bookings/[id]/edit/page.tsx>) [Form payload builder](../../apps/admin/components/BookingForm/booking-form-data.ts)

**Context** The previous editor rewrote untouched legacy stay timestamps to midnight during a notes-only edit and incorrectly triggered paid-booking repricing protection. The existing PUT schema and `UpdateBookingInput` permit omitting both dates. Retaining one legacy endpoint when moving the other can change the Denver stay-length calculation. [Actual PUT regression](../../apps/admin/__tests__/integration/api/bookings.test.ts)

**Interfaces:** Mount the loaded edit form keyed by booking ID after the resolved DTO matches the current route ID (`keepPreviousData` can retain a different record). Same-record revalidation preserves its draft and initialization baseline, including through failed refresh and recovery while the existing error page remains visible. Accepted uppercase ObjectId routes match canonical serialized IDs without changing transport behavior. A selected customer with known identity remains an option even if absent from the first twenty/search results; deduplicate by the Clerk ID. Missing/deleted customer references remain explicit, including an automatic saved selection whose profile becomes unresolved during a same-record refresh; cached list data cannot silently restore it. Recovery, deliberate valid replacement and intentional clearing preserve their respective draft semantics. Never infer the missing profile's cause, invent an identity or change server eligibility.

For an edit, omit both stay-date fields when the complete selected calendar range equals that same-record initialization baseline, including after a change is reverted. When either selected day actually changes, keep the existing two UTC-midnight fields. Creation also keeps both fields. Use the supported typed update shape without unsafe assertions. Do not alter server calculation, guards, stored values or the actual-date-change policy.

- [x] Add a regression for a cold detail fetch resolving after initial render and for the saved customer being absent from a paginated/search list.
- [x] Cover user edits while data revalidates, switching record identity, a legitimate missing populated customer, replacement/clear of the selected customer and both confirmed/unconfirmed initialization.
- [x] Fix the initialization and selected-option boundaries with the smallest state change. Preserve submit/reset semantics and search pagination. Add RED/GREEN form payload and actual PUT coverage for a paid non-midnight stay with only special requests changed: omit the unchanged date pair, save the note, and preserve exact stored dates/nights/receipts. A real date move still sends both existing midnight values and returns the receipt/checkout conflict; creation and change-then-revert behavior remain explicit.
- [x] Run focused form/page/selector tests, surrounding mutation tests, admin types and strict changed-test types. Preserve unpaid versus paid/active-checkout guards; characterize any relevant eligible edit path with existing fixtures rather than changing policy.
- [x] Format touched files, document the correction and commit the slice.

### Task 4: Restore mobile control reachability and modal toast accessibility

**Ownership:** Dining add/edit/view modal layout, Calendar header/row styles, admin `app/providers.tsx` and a small app-local toast portal component if needed, focused interaction checks and disposable responsive fixtures. Customer providers, dependencies and shared package structure are outside this task. The user clarified that the reported missing notification occurred in Zen responsive simulation at iPhone/Samsung screen sizes. The action is unknown. The visual report and the confirmed modal accessibility defect have separate fixture evidence. [Responsive layout and notifications](phase-4-browser-review.md#responsive-layout-and-notifications)

**Interfaces:** Keep HeroUI's modal shell and one vertical scroll owner. Constrain the mobile Dining modal to the available visual viewport, not a competing static viewport height. Calendar's Listing header and row header use consistent mobile positioning while preserving desktop sticky behavior and occupancy/date semantics.

The approved admin toast accessibility correction renders the existing ToastProvider inline on the initial render, then moves that same provider configuration directly to `document.body` with React's `createPortal` after mount. Keep it within the existing React provider/context tree. A null-until-mounted guard loses early notifications and is not acceptable. The body portal lets the library's existing top-layer marker escape an already aria-hidden root. It intentionally makes toast controls reachable by keyboard while the modal is open. Preserve early/switch/post-mount emissions, styling/theme/context, visual placement, actions/dismissal and modal focus restoration. No new queue, private-marker injection or library upgrade.

- [x] Reuse the explorer fixtures to reproduce Dining clipping, Calendar overlap and first-modal-toast AX hiding. Record phone and desktop before/after evidence. Final geometry must come from actual changed component classes and freshly compiled CSS (or real changed components), not the probe's hardcoded hypothetical candidate. See the [actual-source geometry results](phase-4-browser-review.md#responsive-layout-and-notifications).
- [x] Make the narrow layout corrections, without changing fields, validation, mutations, calendar data or redesigning the Reservations table.
- [x] Verify Dining first fields and final actions through the single body scroller, normal/reduced visible phone viewports and desktop, and the shared view shell. Verify Calendar header/row positions and date/link hit tests after horizontal scroll, with desktop stickiness retained.
- [x] Verify the real admin toast change in the existing Chromium and Zen fixtures, plus a controlled server-render/hydration check and initial-child-effect/switch/post-mount emissions. Check AX inclusion, background hiding, touch/keyboard action and dismissal, theme/context and modal focus restoration. Record the new keyboard access. If a genuine environment blocker prevents validating this optional portal correction, leave that source correction deferred and document the evidence; complete independent layout work. The unknown original visual toast action stays unverified.
- [x] Run affected component tests and admin types; use browser measurements/screenshots for the CSS behavior instead of tests that merely mirror class strings.
- [x] Format touched files and commit with responsive verification limits explicitly recorded.

### Task 5: Keep checkout failures safe and pin booking edit eligibility

**Ownership:** `apps/customer/hooks/usePayment.ts`, `apps/customer/lib/open-reservation-checkout.ts`, one browser-safe `apps/customer/lib/validations/checkout-response.ts`, focused checkout/confirmation tests, and narrow existing HTTP smoke booking-edit assertions. The controller owns plan and ledger changes. No changes to server checkout generation, provider operations, booking policy, history UI eligibility, amounts or stored dates.

**Context:** The read-only audit reproduced raw parser errors for both checkout entry points on text/HTML/empty responses and a TypeError for JSON null. Cabin checkout also treated a 200 response with no URL as success and invalidated its caches. Controlled actual customer PATCH tests established the existing eligible/blocked edit matrix. [Checkout failure fixtures](../../apps/customer/__tests__/shared/checkout-failure-fixtures.ts) [HTTP owner edit regressions](../../scripts/http-smoke/run.mjs) [Recorded outcomes](phase-4-browser-review.md#guestextras-edit-and-checkout-outcomes)

**Interfaces:** Parse unknown JSON once through a small shared checkout response reader. Return the existing `{ url: string }` only for HTTP OK, literal success, and a usable absolute HTTP(S) URL; preserve the exact accepted URL text and additive success fields. Characterize observed provider/local fixture URLs before enforcing URL checks. No new hostname allowlist or provider URL rewriting. Keep known nonempty string API errors verbatim and operation fallbacks: cabin `Failed to create checkout session`, reservation `Unable to start checkout`. Cabin invalidations and reservation navigation happen only after validated success. Use named options for the reader's arguments.

- [x] Add RED cases for 404 text, 200 HTML, empty 401, null/primitives, missing/wrong/unsafe URL, false/nonliteral success, malformed errors, and non-2xx success-looking responses. Keep structured 401/409 messages and existing valid checkout URLs working.
- [x] Implement the shared reader and migrate both entry points. Verify exact existing POST routes/bodies, retry, success invalidations, displayed fallback, and navigation for both reservation kinds. Preserve creation forms' existing payment-required handling.
- [x] Promote the missing owner PATCH cases into the existing disposable HTTP gate: confirmed unpaid guest/extras edits preserve status and exact non-midnight dates, recalculate totals/deposit/balance and add no receipts; partial-receipt and active-checkout states return exact 409 without writes. Reuse existing fixtures at the appropriate sequential stages or add isolated records; do not disturb other checkout assumptions or change eligibility.
- [x] Run focused customer checkout, confirmation, mutation-cache, route suites and app types; run the affected HTTP gate with disposable services and controlled providers. Record RED/GREEN and explicit hosted-browser limits, format touched files and commit.

### Task 6: Reconcile Phase 4 evidence and remaining acceptance

**Ownership:** `docs/refactoring/phase-4-browser-review.md`, `phase-4-browser-fixes-plan.md`, `phase-4-ui-state.md`, `plan.md`, `inventory.md`, and this continuation plan. Documentation only. No production data/provider writes and no browser automation framework.

**Interfaces:** Consume Tasks 1–5 reports and the accepted #202 delivery. Preserve dated original browser findings as historical evidence, record each implemented fix and actual checks, and keep genuine hosted/device/payment acceptance gaps explicit.

- [x] Record #202 user acceptance and b190f44 base, and update stale statements that no browser retest occurred.
- [x] Record the existing guest/extras edit eligibility, exact guard outcomes and controlled checkout response correction. Distinguish the API's confirmed/unconfirmed allowance from the unchanged history UI eligibility.
- [x] Reconcile the real provider toast fixture and native/mobile/booking/payment verification limits. Normal Chromium toast visibility passes; consume the follow-up Zen/Gecko responsive evidence. Pinch viewport and modal accessibility observations are separate. The original failing action is unknown; do not describe the responsive-emulation report as a native iPhone keyboard report. Do not label Phase 4 complete solely because code/tests pass.
- [x] Replace ephemeral audit pointers in the tracked plan with durable source/test/finding references where possible; retain actual local evidence paths in the task report. Record exact commands/results and update remaining Phase 6 overlap so its checkout task consumes this implemented boundary.
- [x] Update documentation with remaining acceptance and Phase 6 work, run formatting/path checks and commit. The controller then performs the whole-plan review and continues the separately scoped Phase 6 plan.

## Recorded validation

The continuation baseline at `b190f44f504db36c0b5a1d0666e366749391dd04`
passed `pnpm install --frozen-lockfile` and all 2,752 package tests
(admin 1,708, customer 945, database 96 and email 3) with Node 22.23.2
and pnpm 11.17.0. Commands below use `pnpm` for the pinned local runner.
Full-suite totals refer to the individual checkpoints named here.

- **Settings (`4f58442`, review correction `3a0d20f`).** `pnpm --filter @lodgeflow/admin test`
  passed 1,709 tests at the first commit. Focused Jest runs covered the
  form, hooks, schema and routes. The final scope passed 70 tests across eight
  suites with admin app and strict changed-test types.
  [Form regression](../../apps/admin/__tests__/components/SettingsForm.test.tsx)
- **Stay labels (`1c4a0e9`, final email correction `376d673`).**
  `pnpm --filter @lodgeflow/admin test` passed 1,721 tests at the first commit.
  Focused Jest ran in distinct processes with `TZ=America/Denver`, `TZ=UTC` and
  `TZ=Asia/Tokyo`, passing 69 tests per zone. The Tokyo integration run
  passed 38 transport/status tests. At the final correction,
  `pnpm --filter @lodgeflow/admin exec jest --runInBand --runTestsByPath __tests__/unit/api/confirmation-email.test.ts`
  passed 23 tests in each zone and the strict test compiler check passed.
- **Booking editor (`1d855bf`, review correction `d70260a`).**
  The Denver focused Jest run passed 90 tests, including the actual PUT.
  `pnpm --filter @lodgeflow/admin test --runInBand` passed 1,745 tests at the
  first commit. The final unresolved-guest correction passed 64 focused
  tests across seven jsdom suites, admin app types and strict changed-test
  types. [Editor regression](../../apps/admin/__tests__/components/BookingEditPage.test.tsx)
  [PUT regression](../../apps/admin/__tests__/integration/api/bookings.test.ts)
- **Dining, Calendar and toasts (`81fda6c`).**
  `pnpm --filter @lodgeflow/admin exec jest --selectProjects jsdom --runInBand --runTestsByPath __tests__/components/Providers.test.tsx`
  passed both cases after one baseline failure.
  `pnpm --filter @lodgeflow/admin test` passed 1,751 tests across 124 suites.
  Admin app/strict changed-test types, read-only ESLint and formatting passed.
  Actual-source Chromium geometry went from 69 failures to zero. Chromium
  accessibility, Zen responsive modal/interaction and controlled React
  render/hydration fixtures passed their stated checks.
- **Checkout and owner PATCH (`510f93d`).** Focused Jest reproduced 71 checkout
  failures and passed 229 tests across eight suites after the change.
  `pnpm --filter @lodgeflow/customer test --runInBand` passed 1,052 tests across
  72 suites. Both app type checks, customer read-only ESLint and touched-file
  formatting passed. `pnpm test:http` passed with disposable services and
  controlled providers, including all three new owner PATCH assertions.

[Detailed browser and edit outcomes](phase-4-browser-review.md#remaining-functional-fixes-and-local-evidence-2026-11-25)
covers the fixture results and separates the open hosted/device checks.

At runtime commit `510f93d`, `pnpm ci:check` passed formatting, read-only lint
and all 2,902 package tests (admin 1,751, customer 1,052, database 96 and email 3).
Both app `exec tsc --noEmit --incremental false` checks passed. `pnpm build`
passed with CI's throwaway public Clerk key and no Stripe/Resend secrets. Both
app builds recorded the existing Next.js 16 warning about React 18 and the
admin build recorded the existing Tailwind config module-type warning. The
isolated `pnpm test:http` result is recorded in the checkout result above.
Phase 4 browser and payment acceptance remains open.

At `2302834`, the final Settings and booking corrections passed 102 focused
tests in seven suites, including real controls, the staff guard and disposable
booking PUTs. The full admin command `pnpm --filter @lodgeflow/admin test --runInBand`
passed 1,763 tests in 124 suites. Admin app types, strict changed-test types,
read-only admin ESLint and touched-source Prettier also passed.

### Reproduce the focused checkpoints

Run each command from the workspace root with the pinned Node and pnpm versions.

Settings at `3a0d20f` passed 70 tests in eight suites.

```sh
pnpm --filter @lodgeflow/admin exec jest --runInBand --runTestsByPath \
  __tests__/components/SettingsForm.test.tsx __tests__/hooks/useSettings.test.ts \
  __tests__/hooks/useSettings.mutations.test.ts __tests__/hooks/cacheRefresh.test.tsx \
  __tests__/validations/settings.test.ts __tests__/api/settings.test.ts \
  __tests__/integration/api/settings.test.ts __tests__/integration/api/settings-json.test.ts
```

The initial booking editor checkpoint passed 90 tests in Denver, including
the disposable PUT suite.

```sh
TZ=America/Denver pnpm --filter @lodgeflow/admin exec jest --runInBand \
  --testPathPatterns='BookingEditPage|BookingJsonConsumers|useBookingForm|useInfiniteCustomers|useBooking.*Mutation|integration/api/bookings.test'
```

The booking editor at `d70260a` passed 64 tests in seven jsdom suites.

```sh
pnpm --filter @lodgeflow/admin exec jest --selectProjects jsdom --runInBand \
  --testPathPatterns='BookingEditPage|BookingJsonConsumers|BookingDatesGuests|PaymentInformation|useBookingForm|useInfiniteCustomers|useBooking.*Mutation'
```

Checkout at `510f93d` passed 229 tests in eight suites.

```sh
pnpm --filter @lodgeflow/customer exec jest --runInBand --runTestsByPath \
  __tests__/bookings/useCreateCheckout.test.tsx __tests__/lib/open-reservation-checkout.test.ts \
  __tests__/reservations/confirmation-payments.test.tsx __tests__/bookings/BookingConfirmation.test.tsx \
  __tests__/bookings/mutation-cache.test.tsx __tests__/api/create-checkout.test.ts \
  __tests__/api/reservation-checkout.test.ts __tests__/api/booking-boundary.test.ts
```

## Phase 6 handoff

Continue the remaining V03 readers and O01 compiler/test-helper work from the
reviewed continuation. The Phase 6 checkout task consumes the existing
[response reader](../../apps/customer/lib/validations/checkout-response.ts) and
[consumer regression](../../apps/customer/__tests__/bookings/useCreateCheckout.test.tsx).
Use existing route and HTTP coverage for accepted provider handoffs and retry,
and extend the reader only for a demonstrated remaining gap. Keep Settings
response parsing compatible with the sparse writable input, and keep booking
response readers compatible with stay labels, retained editor drafts and
calendar positioning. [Milestone Phase 6 gates](plan.md#phase-6--remaining-debt-and-milestone-verification)

## Review and delivery checkpoint

The final integration corrections in `2302834` passed all 1,763 admin tests and
102 focused tests. The controller then passed frozen installation, `pnpm ci:check`
(2,914 tests: admin 1,763, customer 1,052, database 96, email 3), `pnpm test:http`,
the production catalog-freshness command above and `pnpm build` at `a5d8ced`.
The scoped re-review cleared all twelve assigned corrections with no remaining
Critical or Important finding. Hosted/browser acceptance remains separate.

One nonblocking follow-on remains: for a legacy booking with an absent or null
payment method, selecting and then undoing a new method still retains that new
selection. The next bounded slice will restore the ability to return that draft
to blank without permitting a saved method to disappear. This is recorded in the
Phase 4 PR and assigned before the remaining Phase 6 response/typing work.
