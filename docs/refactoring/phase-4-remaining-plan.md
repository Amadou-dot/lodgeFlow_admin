# Remaining Phase 4 functional fixes implementation plan

> **For agentic workers:** Use `superpowers:subagent-driven-development` task by task. Implement only the task brief supplied by the controller. Do not spawn other agents.

**Goal:** Finish the reproducible remaining Phase 4 functional fixes while preserving the established refactor contracts.

**Architecture:** Keep the current Next.js, HeroUI, Clerk and cache architecture. Project editable Settings requests, format stay dates at display boundaries, initialize booking forms from loaded records, and constrain existing mobile layouts. This is a continuation of the authorized refactor plan, not a redesign.

**Tech Stack:** Node 22, pnpm 11.17.0, TypeScript, Next.js 16, React 18, HeroUI v2, SWR/TanStack Query, Jest, MongoDB/Mongoose.

**Spec:** `AGENTS.md`, `docs/refactoring/plan.md` and `docs/refactoring/phase-4-browser-review.md`; user authorized remaining slices on 2026-11-25 after accepting and merging #202.

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

**Context:** `/tmp/lodgeflow-phase4-contract-audit.md` section 1 contains the verified full path. The form currently sends its entire AppSettings read DTO, which the strict PUT schema rejects for `singleton`/`fullAddress`; untouched `contactInfo:null` is another incompatible read representation.

**Interfaces:** Consume `UpdateSettingsInput` from the existing Settings validation module. The update hook accepts that request shape and returns `AppSettings`. Build a new sparse payload from editable revisioned changes. Successful saves adopt the returned full DTO as the baseline, while retaining changes newer than the submitted revision.

- [x] Add a failing realistic form regression: edit breakfast price on a read DTO containing metadata, singleton, fullAddress and untouched null contactInfo; the submitted body must be exactly the changed editable field and pass the real update schema.
- [x] Pin existing failure/retry/discard and save/reset pending-edit/revert behavior; assert the next save carries the retained edit, and the response rather than the submitted snapshot becomes the server baseline.
- [x] Implement the typed sparse request boundary and migrate the only PUT hook caller. Preserve deep equality, revision tracking, min/max state validation, cache refresh and reset behavior.
- [x] Run Settings component/hooks/cache/validation tests and relevant route tests; run admin types and strict compilation of changed tests. Record RED and GREEN evidence. Format only touched files.
- [x] Update this plan's task checklist and commit the bounded change. Report files, test commands/results, caveats and commit.

### Task 2: Keep cabin stay labels on the intended calendar date

**Ownership:** New `apps/admin/lib/booking-stay-date.ts`; `apps/admin/utils/bookingUtils.ts`; `components/BookingDetails/BookingStatusDates.tsx`; `components/BookingDetails/BookingPDFTemplate.tsx`; `app/(dashboard)/guests/[id]/page.tsx`; `components/EmailTemplates.tsx`; focused date/booking/print/email tests. Do not change calendar occupancy, forms' wire dates, relative status wording, stored dates, calculations or actual event renderers.

**Context:** `/tmp/lodgeflow-phase4-contract-audit.md` section 2 inventories all relevant consumers. Existing editor/calendar/inbox consumers already use UTC date keys. Other absolute stay labels format UTC-midnight values in the viewer timezone and display the previous day in Denver.

**Interfaces:** Export `formatBookingStayDate({ date, style })`, accepting only the serialized string and a small union of the existing presentation variants. Use a fixed en-US/UTC calendar formatter and preserve each caller's existing month/day padding and malformed-date fallback. Apply only to planned stay labels. Admin booking confirmation email shares the label formatter for canonical ISO calendar dates and explicitly zoned ISO instants. Its existing permissive input boundary retains prior native local formatting for offset-free date-times and non-ISO legacy forms, without changing accepted inputs or sending behavior.

- [x] Reproduce March 20–23, 2027 displaying a day early in Denver using failing helper/component assertions before implementation.
- [x] Cover UTC midnight, a non-midnight legacy ISO instant, month/year or DST boundary and existing invalid-input fallbacks. Assert unchanged strings/stay lengths and local actual event timestamps.
- [x] Implement the one browser-safe formatting boundary and migrate the inventoried absolute stay-label consumers.
- [x] Run focused tests in separate processes under `TZ=America/Denver`, `TZ=UTC`, `TZ=Asia/Tokyo`; run affected booking/print/email suites, admin types and strict changed-test types. Preserve passing UTC picker/transport coverage.
- [x] Record the display-only behavior correction, format touched files and commit the slice.

### Task 3: Preserve booking edit initialization and selected customer

**Ownership:** Admin booking edit page, `hooks/useBookingForm.ts` and `components/BookingForm/CustomerSelection.tsx` plus directly related types, form/page tests and focused existing admin booking route integration tests. Determine exact files from `/tmp/lodgeflow-phase4-mobile-audit.md`; no server request-schema, domain or payment-policy changes.

**Context:** `/tmp/lodgeflow-admin-legacy-date-audit.md` additionally reproduces a false paid-booking repricing conflict: the current editor rewrites untouched legacy stay timestamps to midnight during a notes-only edit. The existing PUT schema and `UpdateBookingInput` already permit omitted dates. Retaining one legacy endpoint when moving the other changes the existing Denver stay-length calculation, so avoid that mixed-endpoint change.

**Interfaces:** Mount the loaded edit form keyed by booking ID after the resolved DTO matches the current route ID (`keepPreviousData` can retain a different record). Same-record revalidation preserves its draft and initialization baseline. A selected customer with known identity remains an option even if absent from the first twenty/search results; deduplicate by the Clerk ID. Missing/deleted customer references remain explicit; never invent an identity or bypass guest eligibility.

For an edit, omit both stay-date fields when the complete selected calendar range equals that same-record initialization baseline, including after a change is reverted. When either selected day actually changes, keep the existing two UTC-midnight fields. Creation also keeps both fields. Use the supported typed update shape without unsafe assertions. Do not alter server calculation, guards, stored values or the actual-date-change policy.

- [ ] Add a regression for a cold detail fetch resolving after initial render and for the saved customer being absent from a paginated/search list.
- [ ] Cover user edits while data revalidates, switching record identity, a legitimate missing populated customer, replacement/clear of the selected customer and both confirmed/unconfirmed initialization.
- [ ] Fix the initialization and selected-option boundaries with the smallest state change. Preserve submit/reset semantics and search pagination. Add RED/GREEN form payload and actual PUT coverage for a paid non-midnight stay with only special requests changed: omit the unchanged date pair, save the note, and preserve exact stored dates/nights/receipts. A real date move still sends both existing midnight values and returns the receipt/checkout conflict; creation and change-then-revert behavior remain explicit.
- [ ] Run focused form/page/selector tests, surrounding mutation tests, admin types and strict changed-test types. Preserve unpaid versus paid/active-checkout guards; characterize any relevant eligible edit path with existing fixtures rather than changing policy.
- [ ] Format touched files, document the correction and commit the slice.

### Task 4: Make existing mobile Dining and Calendar controls reachable

**Ownership:** Dining add/edit modal layout and Calendar header/row styles, their focused interaction tests and the documented disposable responsive fixture. Exact paths and evidence are in `/tmp/lodgeflow-phase4-mobile-audit.md`. Toast investigation is read-only unless a reproduced defect identifies a narrow correction; seek a controller ruling before adding source scope. The user clarified the reported missing notification occurred in Zen responsive simulation at iPhone/Samsung screen sizes, with the action forgotten; a physical-device keyboard failure was not reported.

**Interfaces:** Keep HeroUI's modal shell and one vertical scroll owner. Constrain the mobile Dining modal to the available visual viewport, not a competing static viewport height. Calendar's Listing header and row header use consistent mobile positioning while preserving desktop sticky behavior and occupancy/date semantics.

- [ ] Reuse the explorer's compiled-CSS/browser fixture to reproduce reduced visual viewport Dining clipping and Calendar horizontal overlap. Record both phone and desktop results before edits.
- [ ] Make the narrow layout corrections, without changing fields, validation, mutations, calendar data or redesigning the Reservations table.
- [ ] Verify all Dining fields/actions remain reachable at the phone viewport and reduced visual viewport; verify horizontal Calendar dates are exposed and desktop listing stickiness remains. Exercise toast provider/rendering in the fixture and report actual evidence rather than inventing a cause.
- [ ] Run affected component tests and admin types; use browser measurements/screenshots for the CSS behavior instead of tests that merely mirror class strings.
- [ ] Format touched files and commit with responsive verification limits explicitly recorded.

### Task 5: Keep checkout failures safe and pin booking edit eligibility

**Ownership:** `apps/customer/hooks/usePayment.ts`, `apps/customer/lib/open-reservation-checkout.ts`, one browser-safe `apps/customer/lib/validations/checkout-response.ts`, focused checkout/confirmation tests, and narrow existing HTTP smoke booking-edit assertions. The controller owns plan and ledger changes. No changes to server checkout generation, provider operations, booking policy, history UI eligibility, amounts or stored dates.

**Context:** The read-only audit reproduced raw parser errors for both checkout entry points on text/HTML/empty responses and a TypeError for JSON null. Cabin checkout also treated a 200 response with no URL as success and invalidated its caches. Controlled actual customer PATCH tests established the existing eligible/blocked edit matrix. Evidence is in `/tmp/lodgeflow-phase4-payment-audit.md`, with the disposable probe paths it lists.

**Interfaces:** Parse unknown JSON once through a small shared checkout response reader. Return the existing `{ url: string }` only for HTTP OK, literal success, and a usable absolute HTTP(S) URL; preserve the exact accepted URL text and additive success fields. Characterize observed provider/local fixture URLs before enforcing URL checks. No new hostname allowlist or provider URL rewriting. Keep known nonempty string API errors verbatim and operation fallbacks: cabin `Failed to create checkout session`, reservation `Unable to start checkout`. Cabin invalidations and reservation navigation happen only after validated success. Use named options for the reader's arguments.

- [ ] Add RED cases for 404 text, 200 HTML, empty 401, null/primitives, missing/wrong/unsafe URL, false/nonliteral success, malformed errors, and non-2xx success-looking responses. Keep structured 401/409 messages and existing valid checkout URLs working.
- [ ] Implement the shared reader and migrate both entry points. Verify exact existing POST routes/bodies, retry, success invalidations, displayed fallback, and navigation for both reservation kinds. Preserve creation forms' existing payment-required handling.
- [ ] Promote the missing owner PATCH cases into the existing disposable HTTP gate: confirmed unpaid guest/extras edits preserve status and exact non-midnight dates, recalculate totals/deposit/balance and add no receipts; partial-receipt and active-checkout states return exact 409 without writes. Reuse existing fixtures at the appropriate sequential stages or add isolated records; do not disturb other checkout assumptions or change eligibility.
- [ ] Run focused customer checkout, confirmation, mutation-cache, route suites and app types; run the affected HTTP gate with disposable services and controlled providers. Record RED/GREEN and explicit hosted-browser limits, format touched files and commit.

### Task 6: Reconcile Phase 4 evidence and remaining acceptance

**Ownership:** `docs/refactoring/phase-4-browser-review.md`, `phase-4-browser-fixes-plan.md`, `phase-4-ui-state.md`, `plan.md`, `inventory.md`, and this continuation plan. Documentation only. No production data/provider writes and no browser automation framework.

**Interfaces:** Consume Tasks 1–5 reports and the accepted #202 delivery. Preserve dated original browser findings as historical evidence, record each implemented fix and actual checks, and keep genuine hosted/device/payment acceptance gaps explicit.

- [ ] Record #202 user acceptance and b190f44 base, and update stale statements that no browser retest occurred.
- [ ] Record the existing guest/extras edit eligibility, exact guard outcomes and controlled checkout response correction. Distinguish the API's confirmed/unconfirmed allowance from the unchanged history UI eligibility.
- [ ] Reconcile the real provider toast fixture and native/mobile/booking/payment verification limits. Normal Chromium toast visibility passes; consume the follow-up Zen/Gecko responsive evidence. Pinch viewport and modal accessibility observations are separate. The original failing action is unknown; do not describe the responsive-emulation report as a native iPhone keyboard report. Do not label Phase 4 complete solely because code/tests pass.
- [ ] Replace ephemeral audit pointers in the tracked plan with durable source/test/finding references where possible; retain actual local evidence paths in the task report. Record exact commands/results and update remaining Phase 6 overlap so its checkout task consumes this implemented boundary.
- [ ] Update documentation with remaining acceptance and Phase 6 work, run formatting/path checks and commit. The controller then performs the whole-plan review and continues the separately scoped Phase 6 plan.
