# Phase 4 browser acceptance findings

## Status and provenance

**Acceptance remains open: failures reported.** The user supplied
`phase4_browser_sign_off.md` on 2026-11-03 and confirmed that all checks used the
production sites. Desktop checks used Zen on Linux, except the catalog pending-save
check, which used Firefox. Mobile checks used an iPhone 15 Pro Max; its browser was
not specified. The exact test times and deployed commit were not captured.

The user's original report is preserved unchanged in the workspace. This document
records its findings and subsequent triage against local commit `216970d`.
User-observed browser results, source inspection, local probes and public HTTP
checks are distinguished below. Triage made no runtime changes; the approved
2026-11-05 follow-up is recorded below and in
[the implementation plan](phase-4-browser-fixes-plan.md). No authenticated browser
retest has been performed. These findings do not establish which defects were
introduced by Phase 4.

## Checklist results

| Check                            | Recorded result                                                                                                                                                                                                                                                      | Follow-up                                                                                                                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Customer login/privacy        | Fail: Back after sign-out exposes booking history and details; account switching briefly shows the prior account's bookings. Cancellation is denied; checkout exposes a JSON parsing error.                                                                          | Clear and isolate private client data across auth changes, including retained modal context. Verify safe handling of signed-out responses. Booking dates, prices and observations remain private even without identity fields. |
| 2. Customer booking flows        | Incomplete: cabin links return 404; dining/experience payment completion was blocked by using a test card in live mode. Opened booking dialogs show their own records.                                                                                               | Repair stale cabin listing data. Retest creation and confirmation separately from settlement; complete payment testing only with an isolated test-mode provider setup.                                                         |
| 3. Customer editing/cancellation | Mixed: cancellation updates immediately. Guest edits are rejected by the payment/active-checkout repricing guard.                                                                                                                                                    | The user is unsure whether the tested records were paid or had checkout open. Retest an unpaid record with no checkout before classifying the rejection as a defect.                                                           |
| 4. Checkout handoff              | Pass, reported in Zen.                                                                                                                                                                                                                                               | This is handoff evidence; it does not establish settlement.                                                                                                                                                                    |
| 5. Staff booking form/refresh    | Search passes. Guest/extras edits hit the same repricing guard. Selected March 20–23, 2027 displays as March 19–22 after save.                                                                                                                                       | Preserve the accounting guard; retest eligible edits. Correct stay-date display without changing stored dates or actual check-in/out timestamps.                                                                               |
| 6. Catalog pending saves         | Pass, reported in Firefox.                                                                                                                                                                                                                                           | Retain this result; retest affected dialogs after fixes.                                                                                                                                                                       |
| 7. Failure/retry                 | Pass, reported in Zen.                                                                                                                                                                                                                                               | Retain this result.                                                                                                                                                                                                            |
| 8. Settings                      | Save fails with `Validation Failed`; Discard Changes passes.                                                                                                                                                                                                         | Send only editable Settings fields and preserve pending edits/retry behavior.                                                                                                                                                  |
| 9. Printing/PDF                  | Direct Download as PDF fails because the template element is missing. Print Booking preview, printing and its PDF download pass without page-two clipping. Browser Print clips page two.                                                                             | Repair the direct PDF entry point and reproduce whole-page print pagination separately.                                                                                                                                        |
| 10. Mobile/keyboard              | Keyboard passes. Mobile Reservations functions but presentation is poor; Calendar's sticky Listing column overlaps content; Dining add/edit fields extend above the viewport. Remaining pages pass, with Settings failure repeated and missing toasts also reported. | Fix inaccessible fields and overlapping content; investigate toast visibility. The requested cleaner Reservations presentation and a broader Calendar redesign need a bounded design decision.                                 |

## Evidence from triage

The source descriptions in this section refer to the pre-fix commit `216970d`.

### Private history across authentication changes

[`app/bookings/page.tsx`](../../apps/customer/app/bookings/page.tsx) has no Clerk
render guard and retains selected records in a component-local map. The three
history hooks use keys containing only resource/status, with no account identity
or auth-based enablement:

- [`hooks/useBooking.ts`](../../apps/customer/hooks/useBooking.ts)
- [`hooks/useDiningReservation.ts`](../../apps/customer/hooks/useDiningReservation.ts)
- [`hooks/useExperienceBooking.ts`](../../apps/customer/hooks/useExperienceBooking.ts)

[`app/providers.tsx`](../../apps/customer/app/providers.tsx) keeps one QueryClient
without an auth-change cleanup boundary. This supports the reported stale private
data path; the existing confirmation-page denial tests do not cover the history
page. The reported denied cancellation does not establish every server access
path. [`hooks/usePayment.ts`](../../apps/customer/hooks/usePayment.ts) also attempts
JSON parsing for unsuccessful checkout responses without handling a non-JSON
response. The exact signed-out response remains to be captured.

### Stale production cabin links

Read-only production GETs on 2026-11-03 returned:

- `/cabins`: HTTP 200, with 13 distinct cabin links in the HTML.
- `/api/cabins`: HTTP 200, with 13 active cabins; none of the listing's IDs appears
  in this response.
- Listing-linked `/cabins/6ae79c9e099c80b32868eb97`: HTTP 404.
- Current `/cabins/6aea2f5e7f1050918169c610`: HTTP 200, titled Forest Edge Cabin.

The requests redirected to the canonical `www.lodgeflow.app` host.
[`app/cabins/page.tsx`](../../apps/customer/app/cabins/page.tsx) supplies the initial
records; [`CabinsListClient.tsx`](../../apps/customer/components/CabinsListClient.tsx)
filters those records without fetching a fresh catalog. The page declares no
revalidation policy. This demonstrates stale listing links; the precise cache
invalidation and catalog replacement sequence still needs characterization.
Raw public responses are saved under `/tmp/lodgeflow-phase4-public-*` and
`/tmp/lodgeflow-phase4-stale-cabin.*` in this workspace.

### Settings request/response mismatch

[`SettingsForm.tsx`](../../apps/admin/components/SettingsForm.tsx) merges the full
read DTO into its draft and sends it through
[`useSettings.ts`](../../apps/admin/hooks/useSettings.ts). The
[`Settings serializer`](../../packages/database/src/settings-json.ts) includes
`singleton` and `fullAddress`. The update boundary strips MongoDB metadata but
correctly rejects these additional non-editable fields.

A local probe of the real
[`update schema`](../../apps/admin/lib/validations/settings.ts), after its metadata
adapter, rejected a payload containing an otherwise valid `breakfastPrice` with
`unrecognized_keys: [singleton, fullAddress]`. It used synthetic data and no
database/provider connection. Repair the outgoing editable-field projection;
do not weaken server allowlisting or remove fields from the existing read DTO.

### Stay dates and PDF entry point

[`useBookingForm.ts`](../../apps/admin/hooks/useBookingForm.ts) serializes the chosen
calendar date at UTC midnight.
[`BookingStatusDates.tsx`](../../apps/admin/components/BookingDetails/BookingStatusDates.tsx)
formats it in the browser's local timezone. A Node probe with
`TZ=America/Denver` reproduces `2027-03-20` becoming `2027-03-20T00:00:00.000Z`
and displaying Friday, March 19, 2027. This establishes a display path, not a
stored-date corruption finding. Audit the related list/detail/print displays while
keeping actual event timestamps distinct from stay dates.

[`QuickActionsCard.tsx`](../../apps/admin/components/BookingDetails/QuickActionsCard.tsx)
invokes the direct PDF handler while the template belongs to the print modal.
The missing-element report is consistent with that unmounted template. The user
confirmed that opening Print Booking first allows PDF generation. Browser Print
uses the whole page and needs separate pagination verification; its clipping
cause has not been established.

## Follow-up order and acceptance

1. Private history isolation on sign-out/account switch and safe expired-session
   errors; include delayed responses, Back navigation and modal remounts.
2. Cabin listing freshness after catalog replacement, including links from rendered
   HTML and normal client navigation.
3. Settings editable payloads and admin stay-date rendering, retaining server
   validation, persisted values, accounting and current draft behavior.
4. Verify the approved single Print / Download entry point and its existing preview
   controls, then address mobile Dining reachability, Calendar overlap and toast
   visibility in a separate slice.
5. Retest guest/extras updates on eligible unpaid records and complete the blocked
   customer booking checks in a suitable environment. Track visual redesign wishes
   separately from functional acceptance failures.

For each fix, add a focused failing reproduction before implementation, verify the
affected boundary and repeat the corresponding browser check. Keep Phase 4 and
the milestone acceptance gates open until findings and remaining verification
are resolved or explicitly accepted with their limits. Independent Phase 6 work
can continue, but the privacy and broken-booking-entry findings take priority.

## Approved follow-up implemented for review (2026-11-05)

The user approved three fixes: one Print / Download button, booking-history privacy
and stale cabin links. The print button now opens the existing preview containing
Print and Download PDF. The direct export and whole-page browser-print menu items
are removed; the preview's existing print/PDF implementation remains.

All three customer history queries now require resolved authentication, include
user/session identity and pass cancellation signals to fetch. The mounted Clerk
boundary cancels and removes obsolete history while preserving public caches.
The guarded, session-keyed history page discards old dialogs and drafts. Regression
tests cover sign-out away from history, account switches, a new session for the
same user, delayed reads and edits, and current-session invalidation.

The homepage's featured cabins and `/cabins` listing now wait for a live request
before reading the database. A real production build reproduced the stale links
before the fix. After replacing records in a disposable MongoDB, the same server
now renders current links on both pages, serves the new detail and returns 404
for the removed cabin. CI runs this production regression separately from the
existing HTTP gate.

Local validation passes: 2,743 package tests, formatting, read-only workspace lint,
both app type checks, strict typing of the four changed admin test files, isolated
HTTP, the production catalog regression, frozen installation and all workspace
builds. An independent review found no runtime defects; its pending-edit coverage
gap is now covered by two tests that fail against the old page and pass with the
fix. See [the implementation evidence](phase-4-browser-fixes-plan.md).

These are local implementation results, not production browser acceptance. Retest:

1. Sign out from history and another page, then use Back; no old records or dialogs
   should appear. Switch accounts, including while a read/edit is pending; only the
   current account's records and dialogs should remain.
2. Follow featured and catalog cabin links after a catalog refresh. Use an isolated
   environment for deliberate record replacement; production checks are read-only.
3. Open Print / Download, use Print and Download PDF, and close/reopen the preview.
   Confirm desktop/mobile layout and multi-page output in the real browsers.

Settings saves, admin stay-date display, mobile Dining/Calendar/toast findings and
the incomplete booking/payment checks remain open. Test guest/extras edits on an
unpaid record with no active checkout; preserve the accounting guard. The exact
signed-out checkout response and generic non-JSON error handling also remain
unverified outside this history fix. Phase 4 and the milestone stay open.
