# LodgeFlow staff dashboard

Staff use the dashboard to manage cabin stays, dining reservations, and experiences. The reservation inbox shows the guest, party size, status, and balance across all three. The calendar shows cabin occupancy, seats per dining time, and daily experience capacity. [Staff dashboard](https://admin.lodgeflow.app) · [Screenshots and workspace overview](../../README.md)

## Local setup

Follow the workspace setup to install dependencies and create `apps/admin/.env.local` with these development values. [Setup for both apps](../../CONTRIBUTING.md#run-the-apps-locally)

| Variable                                                | Purpose                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `MONGODB_URI`                                           | Development MongoDB replica set shared with the guest site           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Keys from the same Clerk development instance as the guest site      |
| `LODGEFLOW_STAFF_ORG_ID`                                | Clerk organization whose members can receive application staff roles |

Use a Clerk member of that organization with a MongoDB staff assignment. For a new environment, the bootstrap guide covers the first administrator. Administrators can then manage assignments at `/staff`. [Staff bootstrap](../../docs/superpowers/plans/2026-09-14-application-staff-roles.md)

Run `pnpm dev:admin` from the root and open [localhost:3000](http://localhost:3000). The local `seed` command prints a notice and exits. The HTTP test harness provisions its own data. [Guest identity and demo data](../../docs/guest-identity.md)

## Payments and email

Staff can record cash, bank transfers, and card-terminal receipts. Online dining and experience refunds use `STRIPE_SECRET_KEY` from the same Stripe account and mode as the guest site. Email sends use `RESEND_API_KEY`. The shared `@lodgeflow/email` package selects the payment or notification sender. [Payment and refund workflow](../../docs/reservation-payments.md) · [Environment variables](CLAUDE.md#environment-variables-required)

## Development

Next.js routes live in `app/`, UI components in `components/`, and client queries and mutations in `hooks/`. Request and response schemas live in `lib/validations/`. Both apps use the workspace [database models](../../packages/database/src/models).

| Command from the repository root                          | Purpose                                       |
| --------------------------------------------------------- | --------------------------------------------- |
| `pnpm --filter @lodgeflow/admin test:fast`                | Unit and jsdom tests                          |
| `pnpm --filter @lodgeflow/admin test:integration`         | Integration tests with disposable MongoDB     |
| `pnpm --filter @lodgeflow/admin check:types:test-scripts` | Strict compilation of admin tests and scripts |
| `pnpm --filter @lodgeflow/admin exec tsc --noEmit`        | Application type check                        |

[Admin API](../../docs/api.md) · [Agent guide](../../AGENTS.md) · [MIT license](../../LICENSE)
