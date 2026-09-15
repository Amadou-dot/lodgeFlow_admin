const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/**
 * Normalizes a configured origin into an absolute base URL safe to concatenate
 * paths onto.
 *
 * NEXT_PUBLIC_APP_URL is stored in Vercel as a bare hostname ("lodgeflow.app").
 * A scheme-less value breaks both consumers: Stripe rejects success_url and
 * cancel_url for not being absolute, and `new URL()` throws in metadataBase.
 * Loopback hosts get http, since they have no certificate.
 */
export function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const scheme = LOOPBACK.test(trimmed) ? 'http' : 'https';
  return `${scheme}://${trimmed}`;
}
