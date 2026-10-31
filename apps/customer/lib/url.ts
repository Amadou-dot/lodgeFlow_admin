const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export class ApplicationOriginConfigurationError extends Error {
  constructor() {
    super(
      'Application origin must be an HTTP(S) origin without credentials, path, query or fragment'
    );
    this.name = 'ApplicationOriginConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Accept legacy bare hostnames and local/preview overrides, but require an
 * origin: path/query/fragment components would corrupt appended return URLs.
 * Do not include the configured value in errors; it may contain credentials.
 */
export function normalizeBaseUrl(url: string): string {
  const input = url.trim();
  const trimmed = input.replace(/\/+$/, '');
  const scheme = LOOPBACK.test(trimmed) ? 'http' : 'https';
  const absolute = /^https?:\/\//i.test(input)
    ? trimmed
    : `${scheme}://${trimmed}`;

  // Check before URL parsing, which silently removes dot paths and whitespace.
  if (!/^https?:\/\/[^\s/\\@?#]+$/i.test(absolute)) {
    throw new ApplicationOriginConfigurationError();
  }

  try {
    return new URL(absolute).origin;
  } catch {
    throw new ApplicationOriginConfigurationError();
  }
}

/** Read configuration at the boundary; checkout retains its request fallback. */
export function getCustomerOrigin({
  requestOrigin,
}: { requestOrigin?: string } = {}): string {
  const origin = normalizeBaseUrl(
    process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin ?? 'https://lodgeflow.app'
  );
  if (new URL(origin).hostname.replace(/\.$/, '') === 'admin.lodgeflow.app') {
    throw new ApplicationOriginConfigurationError();
  }
  return origin;
}
