# Staff audit history

Step 3 is deployed with application-owned roles. Step 4 adds durable staff mutation
history, readable by managers and administrators through `audit:read`.

## Scope and semantics

- Shared `AuditLog` records include trusted organization, actor ID, role at the time,
  action, resource type/ID, changed fields, and creation time. Indexes support time,
  actor, and resource queries. There is no TTL and no application edit/delete API.
  The demo reset does not touch this collection or staff assignments.
- Explicit mutation hooks cover booking creation/deletion, both booking update APIs,
  payment receipts, refund metadata, both cabin API forms and bulk changes, settings
  updates/reset, and staff role assignments. Failed and unchanged operations do not
  create audit entries. One booking update can produce multiple action entries when
  it changes both status and money; each retains the full changed-field context.
- Actions include `refund.record`, rather than `refund.issue`: the admin endpoint
  records refund metadata and does not itself issue a Stripe refund. Customer Stripe
  webhooks remain outside this staff-only log. Dining/experience reservation status
  actions are reserved for the next step's new admin mutation endpoints.
- Booking snapshots use an allow-list of reservation/pricing/payment-summary fields.
  Guest observations, payment notes, identity documents, and credentials are excluded.
  Cabin text/image fields and business contact details show `[redacted]` while still
  recording that the field changed. Whole documents and request bodies are never logged.
- Audit writes are awaited after successful domain writes. Per the approved design,
  failures are logged and do not undo a successful mutation. Audit history is therefore
  best-effort, not a transactional or compliance-grade ledger. Catalog bulk operations
  use snapshots around their existing writes; this is not a serializable change stream.
- `/api/audit` enforces organization scope, `audit:read`, bounded pagination, and
  validated action/date filters. `/audit` supports actor, action, resource ID, and UTC
  date filters, displays before/after changes, and paginates history. Navigation and
  the client page guard respect the same permission.

## Verification

- [x] Tests cover real route writes, changed-field diffs, redaction, no-op/failed writes,
  receipt amounts, organization isolation, filters, pagination, permission checks,
  audit failure after a successful mutation, and absence of TTL indexes.
- [x] Formatting, lint, and all 1,139 tests pass (988 admin, 135 customer, 16 database).
- [x] Build both apps and the shared package.
- [x] Verify deployed preview with an isolated temporary resource and staff account.
- [ ] Merge, verify production, and clean up the temporary resource/account.

## Deployment verification

PR 147 merged as `ab443cf`. Admin preview
`lodgeflowadmin-bjt5u2tet-asecklabs.vercel.app` and production
`lodgeflowadmin-iun0vgsvu-asecklabs.vercel.app` are Ready. Both passed authenticated
checks for front-desk denial, manager access, cabin create/update/delete events,
exact $100 → $125 price diffs, redaction, and no-op/invalid updates producing no
event. The production audit page also loaded successfully in a browser. Temporary
cabins were removed; their audit events remain as history. The isolated test identity
is retained only for the immediately following reservations/calendar verification.
