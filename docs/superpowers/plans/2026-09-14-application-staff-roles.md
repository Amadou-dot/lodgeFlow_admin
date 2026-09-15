# Application-owned staff roles

The owner chose LodgeFlow-managed roles after Clerk rejected custom role creation
with HTTP 402. No Clerk subscription upgrade is required. Clerk remains the identity
and organization membership provider; roles are stored in MongoDB.

## Authorization boundary

- `LODGEFLOW_STAFF_ORG_ID` identifies the existing LodgeFlow organization. Configure
  it on the admin Vercel project in Preview and Production. Missing configuration
  denies access. Customer accounts and unrelated organizations cannot grant access.
- Each protected API resolves the current authenticated user and active organization,
  checks live Clerk membership, and reads `StaffAccess` by organization and user ID.
  Clerk role claims and user metadata cannot grant application permissions.
- `StaffAccess` has a unique organization/user index. The manual bootstrap imports
  existing Clerk administrators only when no assignments exist; it never overwrites
  application assignments or runs automatically during requests or demo resets.
- The proxy checks authentication and the trusted organization. Server dashboard
  layout and API handlers enforce actual staff access. Client navigation and disabled
  controls explain access; they are not the security boundary.
- `requireApiAuth({ permission })` enforces the matrix. Calls without a permission
  remain administrator-only. Missing membership, role, or provider availability fails
  closed. There is no cross-request authorization cache delaying revocation.

| Permission | Front desk | Manager | Administrator |
| --- | :-: | :-: | :-: |
| Booking/customer/catalog reads | ✓ | ✓ | ✓ |
| Booking management, guest profiles, payment recording | ✓ | ✓ | ✓ |
| Catalog writes | | ✓ | ✓ |
| Settings writes | | ✓ | ✓ |
| Refund metadata changes | | ✓ | ✓ |
| Audit reads (reserved for Step 4) | | ✓ | ✓ |
| Staff assignments | | | ✓ |
| Booking/customer deletion, guest lock/unlock, settings reset | | | ✓ |

Both booking update APIs separately authorize refund-field writes. This change does
not implement a new staff Stripe refund flow; the existing guest refund flow remains.

## Staff management

`/staff` lists existing organization members and their application access. Only an
application administrator can assign front desk, manager, administrator, or no access.
Adding organization members remains a Clerk dashboard operation. Guests are never
promoted implicitly. Administrators cannot change their own access. Role changes use
transactions that write both the actor and target; concurrent revocation retries with
fresh actor authorization and cannot let two administrators remove one another.

The unauthorized screen allows switching into LodgeFlow from a personal Clerk session.
The sidebar/mobile navigation hide settings and staff administration when unavailable;
catalog edit/delete/create controls are disabled for front desk users.

## Deployment checklist

- [x] Configure the trusted organization in admin Preview and Production.
- [x] Dry-run administrator bootstrap: two existing administrators found.
- [x] Apply bootstrap: two application administrator assignments created.
- [x] Implement membership checks, permission matrix, route enforcement, and staff UI.
- [x] Test organization isolation, missing assignments, membership revocation, unique
  assignments, permission denials, self-change denial, and reciprocal admin revocation.
- [ ] Final checks and Vercel preview verification.
- [ ] Merge and verify production using an isolated staff account, then remove it.

Bootstrap command (dry run by default; add `--apply` once after reviewing the count):

```sh
pnpm --filter @lodgeflow/database exec tsx --env-file=/path/to/private.env scripts/bootstrap-staff.ts
```

Required private environment: `MONGODB_URI`, `CLERK_SECRET_KEY`,
`LODGEFLOW_STAFF_ORG_ID`. Staff assignments survive the manual demo data reset.
