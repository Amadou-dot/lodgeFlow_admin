# LodgeFlow

Hotel management platform: an admin dashboard and a customer-facing booking site
sharing one MongoDB database and one Clerk tenant.

| App | Path | Production |
| --- | --- | --- |
| Admin dashboard | `apps/admin` | https://admin.lodgeflow.app |
| Customer site | `apps/customer` | https://lodgeflow.app |

## Getting started

```bash
pnpm install
pnpm dev:admin      # or: pnpm dev:customer
```

Each app needs its own `.env.local`. `apps/admin/CLAUDE.md` documents its required
variables under **Environment Variables Required**; `apps/customer/.env.example`
documents its — copy it to `.env.local` and fill in real values.

## Workspace scripts

| Command | Effect |
| --- | --- |
| `pnpm build` | Build both apps |
| `pnpm test` | Test both apps and the shared database package |
| `pnpm ci:check` | Format check, lint, and test everything |
| `pnpm --filter @lodgeflow/admin <script>` | Run a script in one app |

`pnpm build` requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for both apps' ClerkProvider
prerendering. Resend and Stripe credentials are needed only when their features run;
SDK clients are constructed lazily. CI builds without those credentials.

## Structure

- `apps/*` — the two Next.js applications, each self-contained
- `packages/database` — shared models, schema enums, database connection, and booking safety helpers. Both apps consume `@lodgeflow/database`.

Schema changes belong in `packages/database` and must pass its tests plus both app suites.
Payment accounting and capacity hardening are shared by both apps. See the
[database verification plan](docs/superpowers/plans/2026-09-14-shared-database.md).

## Staff operations

The admin app uses Clerk for sign-in and organization membership, with application
roles stored in MongoDB. Set `LODGEFLOW_STAFF_ORG_ID` in
`apps/admin/.env.local` for local development (and in each deployed admin
environment), using an organization from the same Clerk instance as the configured
keys. Restart the development server after changing it. Then follow the
[one-time administrator bootstrap](docs/superpowers/plans/2026-09-14-application-staff-roles.md).
A Clerk organization administrator also needs a MongoDB staff assignment; the
Clerk Admin badge alone does not grant application access. Clerk custom roles and
a Clerk subscription upgrade are not required.

- `/staff` — administrator-managed front desk, manager, and administrator assignments.
- `/audit` — permission-scoped staff history with redacted changes.
- `/reservations` — one paginated inbox for cabins, dining, and experiences.
- `/calendar` — month occupancy, dining seats per seating, and daily experience capacity.

See [Admin API documentation](docs/api.md) for permissions and endpoint contracts.
Dining/experience payment collection remains separate unfinished work; paid cancellations
are blocked until their refund flow is implemented.
