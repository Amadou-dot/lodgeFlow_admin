import { runInThisContext } from 'node:vm';

// The jsdom test realm does not install Fetch API response globals.
export const FetchResponse: typeof Response = runInThisContext('Response');

export const checkoutUrl = 'https://checkout.stripe.invalid/session';
export const localCheckoutUrl =
  'HTTP://localhost:80/session/%2f?return=%2F#Checkout';

export const invalidCheckoutResponses: {
  name: string;
  status: number;
  body: string | null;
  headers?: HeadersInit;
}[] = [
  { name: '404 text', status: 404, body: 'Not Found' },
  {
    name: '200 HTML',
    status: 200,
    body: '<html>Sign in</html>',
    headers: { 'Content-Type': 'text/html' },
  },
  { name: 'empty 401', status: 401, body: null },
  { name: 'JSON null', status: 502, body: 'null' },
  { name: 'JSON string', status: 200, body: '"Checkout"' },
  { name: 'JSON number', status: 200, body: '123' },
  { name: 'JSON boolean', status: 200, body: 'true' },
  { name: 'JSON array', status: 200, body: '[]' },
  {
    name: 'missing URL',
    status: 200,
    body: '{"success":true,"data":{}}',
  },
  ...[
    123,
    null,
    '',
    '/checkout',
    '//checkout.invalid/session',
    'https:checkout.invalid/session',
    'https://',
    'https:///checkout.invalid/session',
    'https://checkout.invalid:65536/session',
    'javascript:alert(1)',
    'data:text/html,checkout',
    'ftp://checkout.invalid/session',
  ].map(url => ({
    name: `invalid URL ${JSON.stringify(url)}`,
    status: 200,
    body: JSON.stringify({ success: true, data: { url } }),
  })),
  ...[false, 'true', 1, undefined].map(success => ({
    name: `non-success ${JSON.stringify(success)}`,
    status: 200,
    body: JSON.stringify({ success, data: { url: checkoutUrl } }),
  })),
  ...[42, {}, null, '', '   '].map(error => ({
    name: `invalid error ${JSON.stringify(error)}`,
    status: 409,
    body: JSON.stringify({ success: false, error }),
  })),
  {
    name: 'non-OK success payload',
    status: 502,
    body: JSON.stringify({ success: true, data: { url: checkoutUrl } }),
  },
];

export const checkoutApiErrors = [
  {
    status: 401,
    body: JSON.stringify({ error: 'Authentication required' }),
    message: 'Authentication required',
  },
  {
    status: 409,
    body: JSON.stringify({
      success: false,
      error: 'Booking changed; refresh and try again',
    }),
    message: 'Booking changed; refresh and try again',
  },
  {
    status: 409,
    body: JSON.stringify({ error: '  Refresh and try again.  ' }),
    message: '  Refresh and try again.  ',
  },
];
