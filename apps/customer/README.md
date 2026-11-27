# LodgeFlow guest site

Guests can browse cabins, dining, and guided experiences, then sign in to reserve a stay or an activity. The bookings page brings their reservations together. Paid dining and experience reservations open Stripe Checkout, and guests can resume payment from the confirmation page. [Guest site](https://lodgeflow.app) · [Screenshots and workspace overview](../../README.md)

## Local setup

Follow the workspace setup to configure the guest site's `.env.local` and its shared database and Clerk instance. Run `pnpm dev:customer` from the repository root and open [localhost:3001](http://localhost:3001). The environment example uses this address for local checkout return links. [Setup for both apps](../../CONTRIBUTING.md#run-the-apps-locally) · [Environment example](.env.example)

## Payments and email

Checkout uses `STRIPE_SECRET_KEY`. The webhook at `/api/payments/webhook` verifies the raw request with `STRIPE_WEBHOOK_SECRET` and settles matching payments. Email delivery uses `RESEND_API_KEY` and the shared payment and notification senders. [Reservation payments](../../docs/reservation-payments.md) · [Webhook diagnostics](../../docs/stripe-webhook-diagnostics.md)

## Development

Next.js App Router pages and HTTP handlers live in `app/`. The `hooks/` and `lib/validations/` directories contain the TanStack Query consumers and their response validators. The [shared database package](../../packages/database/src) owns models, pricing, capacity, and settlement.

| Command from the repository root                      | Purpose                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `pnpm --filter @lodgeflow/customer test`              | Customer Jest suite                                                           |
| `pnpm --filter @lodgeflow/customer exec tsc --noEmit` | Application type check                                                        |
| `pnpm test:http`                                      | Isolated HTTP checks across both apps, including checkout and signed webhooks |

[Staff dashboard setup](../admin/README.md) · [Agent guide](../../AGENTS.md) · [MIT license](LICENSE)
