import Stripe from 'stripe';
import { logger } from '@lodgeflow/database/logger';

export type StripeWebhookVerificationStage =
  'stripe-client' | 'request-body' | 'signature';

type FailureCategory =
  | 'stripe_initialization_failed'
  | 'request_body_unreadable'
  | 'missing_payload'
  | 'malformed_signature'
  | 'signature_mismatch'
  | 'timestamp_outside_tolerance'
  | 'signature_verification_failed'
  | 'invalid_json'
  | 'verification_runtime_error';

function failureCategory({
  stage,
  error,
}: {
  stage: StripeWebhookVerificationStage;
  error: unknown;
}): FailureCategory {
  if (stage === 'stripe-client') return 'stripe_initialization_failed';
  if (stage === 'request-body') return 'request_body_unreadable';
  if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
    // SDK messages are inspected only to select a fixed category, never logged.
    if (error.message === 'No webhook payload was provided.')
      return 'missing_payload';
    if (
      error.message ===
        'Unable to extract timestamp and signatures from header' ||
      error.message === 'No signatures found with expected scheme'
    )
      return 'malformed_signature';
    if (
      error.message.startsWith(
        'No signatures found matching the expected signature for payload.'
      )
    )
      return 'signature_mismatch';
    if (error.message === 'Timestamp outside the tolerance zone')
      return 'timestamp_outside_tolerance';
    return 'signature_verification_failed';
  }
  if (error instanceof SyntaxError) return 'invalid_json';
  return 'verification_runtime_error';
}

function signatureTimestampAgeSeconds(signature: string): number | null {
  const timestamp = signature
    .split(',')
    .findLast(part => part.startsWith('t='))
    ?.slice(2);
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return null;
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  return Number.isSafeInteger(age) && Math.abs(age) <= 86_400 ? age : null;
}

export function logStripeWebhookFailure({
  stage,
  error,
  signature,
}: {
  stage: StripeWebhookVerificationStage;
  error: unknown;
  signature: string;
}): void {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const commit = process.env.VERCEL_GIT_COMMIT_SHA;
    const runtime = process.env.NEXT_RUNTIME;
    logger.warn('Stripe webhook verification failed', {
      diagnosticVersion: 1,
      stage,
      category: failureCategory({ stage, error }),
      apiKeyConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      webhookSecretConfigured: Boolean(secret),
      webhookSecretHasWhitespace: /\s/.test(secret ?? ''),
      webhookSecretHasBoundaryQuotes: /^["']|["']$/.test(secret?.trim() ?? ''),
      signatureHasV1: signature.split(',').some(part => part.startsWith('v1=')),
      signatureTimestampAgeSeconds: signatureTimestampAgeSeconds(signature),
      deploymentCommit:
        commit && /^[a-f0-9]{40}$/i.test(commit) ? commit : null,
      runtime: runtime === 'nodejs' || runtime === 'edge' ? runtime : 'unknown',
    });
  } catch {
    // Diagnostics must not alter rejection or weaken signature verification.
  }
}
