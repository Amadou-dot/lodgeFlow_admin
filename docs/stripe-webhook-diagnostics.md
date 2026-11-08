# Stripe webhook verification diagnostics

The customer webhook rejects unverified requests before touching payment data. The response remains `400 { "error": "Invalid signature" }`; details are available only in server logs.

## Logged fields

`Stripe webhook verification failed` includes an explicit allowlist:

- Verification stage: Stripe client initialization, raw body read, or signature verification.
- A fixed failure category, including signature mismatch, malformed header, stale timestamp, invalid JSON, or runtime failure.
- Whether the API key and signing secret are configured, and whether the signing secret contains whitespace or boundary quotes.
- Whether a v1 signature is present, a bounded signing timestamp age, validated deployment commit identity when available, and runtime type.

Raw errors, payloads, signatures, secret values, secret hashes, event identifiers, and payment details are never logged. Diagnostic failures cannot change the webhook response or bypass verification.

## Configuration checks

Use the signing secret for the exact Stripe endpoint and mode. Dashboard endpoint secrets differ from local Stripe CLI listener secrets.

Vercel project-specific variables can override shared variables. Check both scopes when a correctly maintained shared value is not reaching production. Sensitive Secret values cannot be exported for comparison; an empty pulled value does not prove the runtime variable is missing. Redeploy after changing environment configuration.

The November 2026 incident produced a real signature mismatch with both keys present and a two-second signature age. Removing stale project-specific overrides and redeploying the same application code restored HTTP 200 delivery.

## Regression coverage

The route tests exercise real SDK mismatch and timestamp failures, malformed headers, signed invalid JSON, initialization and body-read errors, arbitrary thrown values, log redaction, logger failure, and unchanged valid event processing.
