# Dining and experience payments

## Staff workflow

Open a dining or experience reservation under **Reservations**. **Payments and refunds** shows the total, gross receipts, outstanding balance, refunds, and transaction history.

- Record cash, bank transfers, or external card-terminal payments only after receiving the money. Partial payments are supported.
- Staff with `refunds:issue` can record money returned externally, or select **Stripe online payment** to issue a refund to the original payment method.
- Refunds cannot exceed receipts for the selected method. Refunding does not reopen a balance that was already collected.
- Refund all received funds before cancelling a paid reservation. Cancellation remains a separate status action and releases capacity.
- Online refunds remain pending until Stripe reports success. **Check or retry refund** recovers interrupted requests and checks pending refunds. Failed refunds do not count as money returned.

## Guest workflow

Paid dining and experience booking forms open Stripe Checkout immediately after saving the reservation. If checkout cannot open, guests can resume it from their saved reservation. Confirmation emails follow successful payment settlement and retry with webhook delivery.

Dining and experience confirmation pages offer **Pay outstanding balance**, using Stripe Checkout. The price comes from the reservation on the server. Only the reservation's owner can open checkout. The existing customer `/api/payments/webhook` endpoint records signed payment events; redirects do not mark a reservation paid.

## Configuration

- Customer app: existing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL`.
- Admin app: `STRIPE_SECRET_KEY` for the same Stripe account and mode as the customer app.
- Stripe webhook events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `refund.created`, `refund.updated`, and `refund.failed`. Preserve the existing cabin webhook subscriptions too.
- Amounts use integer cents and the property's existing currency configuration.

## Recovery and historical data

Pending online transactions block manual money entries and reservation edits. Retrying uses the saved Stripe operation and idempotency key. If creation has an unknown outcome for more than 23 hours, staff must reconcile it against Stripe before clearing the operation; do not recreate an unknown charge or refund. Configure and monitor webhook delivery.

Historical `isPaid` records without payment receipts are displayed as paid but require reconciliation before refunding. This change does not invent transaction evidence for those records. Issue reservation refunds through this workflow; refunds created separately in the Stripe Dashboard require reconciliation.

## Verification

Database tests cover both reservation types, partial payments, duplicate requests, concurrent collection, overpayments, tender-specific refund limits, historical records, quote validation, and pending refund recovery. Admin integration tests cover authorization, audit entries, repricing restrictions, and cancellation after reconciliation. Customer webhook tests verify signatures, routing, and failed-delivery retries.
