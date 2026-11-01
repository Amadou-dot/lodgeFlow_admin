const originalKey = process.env.RESEND_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

test.each([undefined, ''])(
  'Resend import needs no key; first use rejects missing configuration (%s)',
  key => {
    if (key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = key;
    jest.isolateModules(() => {
      const {
        getResend,
      }: typeof import('@/lib/resend') = require('@/lib/resend');
      expect(getResend).toThrow(
        'RESEND_API_KEY environment variable is not set'
      );
    });
  }
);

test('a failed first use can recover and subsequent calls reuse the real SDK client', () => {
  delete process.env.RESEND_API_KEY;
  jest.isolateModules(() => {
    const { Resend }: typeof import('resend') = require('resend');
    const {
      getResend,
    }: typeof import('@/lib/resend') = require('@/lib/resend');
    expect(getResend).toThrow();
    process.env.RESEND_API_KEY = 're_test_no_transport';
    const client = getResend();
    expect(client).toBeInstanceOf(Resend);
    expect(getResend()).toBe(client);
  });
});
