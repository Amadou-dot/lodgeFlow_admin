# Phase 4 browser acceptance findings

## Status and provenance

**Phase 4 browser acceptance remains open.** The user supplied
`phase4_browser_sign_off.md` on 2026-11-03 and confirmed that all checks used the
production sites. Desktop checks used Zen on Linux, except the catalog pending-save
check, which used Firefox. Mobile checks used an iPhone 15 Pro Max; its browser was
not specified. The exact test times and deployed commit were not captured.

The user's original report is preserved unchanged in the workspace. This document
records its findings and subsequent triage against local commit `216970d`.
User-observed browser results, source inspection, local probes and public HTTP
checks are distinguished below. Triage made no runtime changes; the approved
2026-11-05 follow-up is recorded below and in
[the implementation plan](phase-4-browser-fixes-plan.md). The
[delivery and acceptance record](#pr-202-delivery-and-user-retest) below includes
the user's subsequent logout → Back retest. The original report does not identify
which changes introduced the defects.

## Original checklist results (2026-11-03)

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

## Original follow-up order

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

## PR #202 delivery and user retest

On 2026-11-25, the user accepted [PR #202](https://github.com/Amadou-dot/lodgeFlow_admin/pull/202)
and specifically confirmed that Back after logout prompts for sign-in. It merged as
`28bedb6fa0f73df78ff3001d9e8d11ab728f8f18`. [PR CI run 45123844150, attempt 2](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/45123844150/attempts/2)
and all five jobs in [post-merge CI run 45724753171](https://github.com/Amadou-dot/lodgeFlow_admin/actions/runs/45724753171)
passed. Both production apps were Ready at the merge SHA. Read-only smoke found
3 current homepage cabin links and 13 current catalog links, zero stale links,
a 200 current cabin detail and admin sign-in page, and a 307 from the protected
admin bookings API to sign-in.

That retest confirms the logout → Back outcome the user observed. Hosted account
switching while history reads or edits are pending, other Back/bfcache sequences
and visual multi-page Print / Download still need representative browser evidence.
Catalog replacement has the disposable production-build regression above and
current links have read-only production coverage. Browser navigation after a
catalog refresh remains a separate interaction check.

## Remaining functional fixes and local evidence (2026-11-25)

The [continuation](phase-4-remaining-plan.md) started at
`b190f44f504db36c0b5a1d0666e366749391dd04`, which includes the merged browser
follow-up and [safe Stripe webhook diagnostics](../stripe-webhook-diagnostics.md).
The following slices have local implementation and review evidence.

- **Settings:** The form sends only edited writable fields. The full server
  response becomes the new baseline, preserving newer edits, pending reverts
  and failure/retry behavior. The regression submits a sparse breakfast-price
  edit through the real schema from a read DTO with metadata, computed fields
  and untouched legacy null contact information. The final scoped run passed
  70 tests across eight suites, including disposable route tests.
  [Settings form regression](../../apps/admin/__tests__/components/SettingsForm.test.tsx)
- **Stay labels:** Planned cabin dates render on their UTC calendar day in the
  booking list, detail, guest recent bookings, preview/PDF template and the
  canonical date branch of the staff confirmation email. Exact serialized and
  stored instants, stay lengths and local actual arrival/departure times are
  preserved. The email still renders accepted offset-free and non-ISO legacy
  values with its native local formatting. The timezone regression ran in
  Denver, UTC and Tokyo, with 69 tests per zone for the main slice and 23
  confirmation route/render tests per zone at the final email correction.
  [Stay-date formatter](../../apps/admin/lib/booking-stay-date.ts)
- **Booking editor:** The matching loaded record initializes the draft. An
  already selected customer survives pagination/search. An automatically
  selected saved guest whose profile becomes unresolved cannot submit via a
  cached option. Same-record refresh preserves the other draft fields, and
  failure keeps the existing error presentation. The actual admin PUT
  accepted a paid notes-only edit with untouched non-midnight stay instants
  and preserved nights and receipts. A genuine date move still sends both
  UTC-midnight fields and returns 409 after payment or while checkout is
  active. The review correction passed 64 focused tests.
  [Booking editor regression](../../apps/admin/__tests__/components/BookingEditPage.test.tsx)
  [Admin PUT regression](../../apps/admin/__tests__/integration/api/bookings.test.ts)

### Guest/extras edit and checkout outcomes

The owner cabin PATCH permits `confirmed` and `unconfirmed` records. An actual
guest/extras change can reprice while the record has zero receipts and no
active checkout. The guard checks receipts and pending checkout even if `isPaid` is false.
A deposit obligation by itself still permits repricing. Any receipt, including
a partial payment, or a pending checkout independently blocks repricing. An eligible notes-only edit need not reprice. Customer history still
offers Edit only for `unconfirmed` bookings and submits guest count only. The
admin PUT evidence separately covers confirmed and unconfirmed unpaid edits.
[Customer update operation](../../packages/database/src/customer-bookings.ts)
[Customer history UI](../../apps/customer/app/bookings/page.tsx)

The disposable customer PATCH probe returned 200 for both eligible statuses.
The committed HTTP suite retains the unconfirmed owner-edit case and adds a
confirmed fixture with exactly `2040-01-07T12:34:56.789Z` and
`2040-01-10T12:34:56.789Z` in the response and database. Its guest/breakfast
edit preserved confirmed status, three nights and zero receipts. Extras
totaled $255, total and balance $855, deposit due $214 and received $0.
Active checkout and partial receipt each returned HTTP 409 with the same
JSON and left the full stored record intact without new provider calls.
[Disposable HTTP scenarios](../../scripts/http-smoke/run.mjs)

```json
{
  "success": false,
  "error": "Price changes are unavailable after payment or while checkout is active"
}
```

Controlled Fetch responses reproduced raw parser errors on text/HTML/empty
responses, a null access error and a cabin checkout success with a missing URL.
The shared reader now requires HTTP OK, literal success and a usable absolute
HTTP(S) URL with an explicit authority before cabin cache refresh or reservation navigation. It preserves
valid URL text and nonempty API error messages. Other failures display
`Failed to create checkout session` for cabin or `Unable to start checkout`
for dining/experience. The reservation creation forms still show
`Payment still required` and continue to confirmation if checkout fails.
The customer focused run passed 229 tests and the full customer suite passed
1,052. Isolated HTTP also passed with signed local Clerk sessions, disposable
MongoDB and controlled providers. The exact hosted expired/signed-out checkout
response and its browser presentation remain unverified.
[Checkout reader](../../apps/customer/lib/validations/checkout-response.ts)

The two checkout routes return `Authentication required` in JSON if reached
without a user. The isolated signed-out cabin HTTP check accepts either a
Clerk-marked 404 rewrite or a configured 307 sign-in redirect before the
route. The UI fallback was verified with controlled responses.
[HTTP auth assertion](../../scripts/http-smoke/assert-http.mjs)

### Responsive layout and notifications

The reported missing toast occurred in Zen's responsive simulation at
iPhone/Samsung sizes. The action is unknown. The original production report
recorded a keyboard pass and separate mobile layout findings. The follow-up
fixture passed normal Chromium visibility at desktop and 430px phone width,
including a shorter 420px layout. Zen 1.24.2b / Gecko 160.0 passed all 40
visibility cases after known success/error emissions at iPhone and Galaxy
widths, including shortened viewports and modal open/closed. In a separate
68-case input investigation, all 60 reached emitters rendered their toasts.
The other eight cases were synthesized WebDriver mouse clicks under touch
emulation that lacked the pointer sequence required by HeroUI `onPress`.
Trusted touch, keyboard activation and the admin-style form submit reached
their callbacks. The original app action remains unknown.

Chromium pinch zoom separately placed an emitted toast below the visual
viewport. This geometry observation remains open. The modal accessibility
reproduction found that the first visible admin toast could sit under an
`aria-hidden` ancestor. The admin provider now renders inline first and moves
to a body portal after mount. Actual-provider fixtures verified Chromium
accessibility-tree inclusion and Zen touch/keyboard actions while the
background remained hidden, including access to the toast action during an
open dialog. Controlled React server render/hydration kept theme/context and
all three startup, portal-switch and post-mount emissions. The sampled
immediate focus after dismissal at the simulated iPhone size was unchanged;
closing the dialog restored its opener. The background Tab sample and mobile
modal footer overlap were also observed with both provider versions.
[Admin provider](../../apps/admin/app/providers.tsx)
[Provider regression](../../apps/admin/__tests__/components/Providers.test.tsx)

Dining add/edit/view now fits the available HeroUI wrapper with one body
scroller. Calendar's Listing header and row headers scroll with the grid
below 640px and both stay sticky at desktop widths. An actual-source fixture
with newly compiled CSS reduced 69 geometry assertion failures to zero.
At 430px width with a 420px visible wrapper the Dining dialog top moved from
−422.8px to 4px and the first field became hit-testable. The body reached the
final controls, and actual Calendar day/link targets were accessible after
horizontal scroll. The full admin suite passed 1,751 tests at this slice.
The CSS build logged Node's module-type warning, and both Zen fixtures
logged browser-internal diagnostics. No page errors or Jest warnings were
recorded in the final Task 4 evidence.
[Dining modal](../../apps/admin/components/DiningModal.tsx)
[Calendar styles](<../../apps/admin/app/(dashboard)/calendar/page.tsx>)

## Remaining browser and payment acceptance

- Complete representative hosted Clerk history/account transitions and
  Print / Download rendering, including visual desktop/mobile multi-page output.
  Keep the user's logout → Back confirmation as a completed observation.
- Recheck Settings save/reset/retry, the booking editor and stay labels with an
  authorized staff browser session. Exercise the customer history guest edit
  on an eligible unconfirmed booking with no receipt or active checkout in an
  isolated environment. Confirmed owner edits have API evidence.
- Verify Dining and Calendar on the native device, including actual keyboard
  behavior if exercised. Verify hosted Next.js dashboard hydration and
  screen-reader announcements, and capture the original Zen notification
  action if it recurs. The fixture's reduced wrapper height and the Chromium
  pinch-zoom result describe different conditions. Broader Reservations and
  Calendar redesigns remain outside the functional slice.
- Verify the actual hosted expired/signed-out checkout response and safe UI
  presentation. Complete cabin booking and dining/experience creation and
  confirmation checks independently of test-mode settlement. The original
  reported Zen handoff passed. Test-card use in live mode blocked settlement
  verification. Use an isolated provider environment for payment
  verification. The prior accepted #132 delivery covers its existing email
  flows, as recorded in [Phase 5](plan.md#phase-5--provider-configuration-and-existing-email-repair).

Phase 4, [issue #150](https://github.com/Amadou-dot/lodgeFlow_admin/issues/150)
and [milestone #2](https://github.com/Amadou-dot/lodgeFlow_admin/milestone/2)
remain open. Independent Phase 6 work follows the locally reviewed source
continuation. [Remaining Phase 6 work](plan.md#phase-6--remaining-debt-and-milestone-verification)
