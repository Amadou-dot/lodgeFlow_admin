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
| `pnpm test` | Test both apps |
| `pnpm ci:check` | Format check, lint, and test everything |
| `pnpm --filter @lodgeflow/admin <script>` | Run a script in one app |

`pnpm build` requires `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` for both apps' ClerkProvider
prerendering. Resend and Stripe credentials are needed only when their features run;
SDK clients are constructed lazily. CI builds without those credentials.

## Structure

- `apps/*` — the two Next.js applications, each self-contained
- `packages/database` — shared models, schema enums, database connection, and booking safety helpers. Both apps consume `@lodgeflow/database`.

Schema changes belong in `packages/database` and must pass its tests plus both app suites.
Payment accounting and capacity hardening follow the extraction; see
`docs/superpowers/plans/2026-09-14-shared-database.md`.
