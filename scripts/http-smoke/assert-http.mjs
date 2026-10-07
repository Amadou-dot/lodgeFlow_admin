import assert from 'node:assert/strict';

export async function expectJson({
  url,
  status,
  method = 'GET',
  headers = {},
  body,
  timeoutMs = 60000,
}) {
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual',
    signal: AbortSignal.timeout(timeoutMs),
  });
  assert.equal(response.status, status, `${method} ${url}: unexpected status`);
  assert.match(
    response.headers.get('content-type') ?? '',
    /application\/json/,
    `${url}: expected JSON`
  );
  return response.json();
}

/** Clerk can deny API requests via a marked rewrite or its configured sign-in URL. */
export function assertAuthenticationDenied(response) {
  if (response.status === 404) {
    assert.equal(
      response.headers.get('x-clerk-auth-reason'),
      'protect-rewrite'
    );
    return;
  }
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.hostname, 'accounts.smoke.test');
  assert.equal(location.pathname, '/sign-in');
}
