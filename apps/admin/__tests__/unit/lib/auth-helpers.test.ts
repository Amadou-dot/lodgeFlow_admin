import { isAuthBypassEnabled } from '@/lib/auth-helpers';

describe('auth-helpers', () => {
  describe('isAuthBypassEnabled', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalBypass = process.env.TESTING_AUTH_BYPASS;
    const originalPublic = process.env.NEXT_PUBLIC_TESTING;

    const setNodeEnv = (value: string | undefined) => {
      // NODE_ENV is typed readonly; override for the test only.
      (process.env as Record<string, string | undefined>).NODE_ENV = value;
    };

    afterEach(() => {
      setNodeEnv(originalNodeEnv);
      process.env.TESTING_AUTH_BYPASS = originalBypass;
      process.env.NEXT_PUBLIC_TESTING = originalPublic;
    });

    it('returns true in a non-production env when TESTING_AUTH_BYPASS=true', () => {
      setNodeEnv('development');
      process.env.TESTING_AUTH_BYPASS = 'true';
      expect(isAuthBypassEnabled()).toBe(true);
    });

    it('fails closed in production even when TESTING_AUTH_BYPASS=true', () => {
      setNodeEnv('production');
      process.env.TESTING_AUTH_BYPASS = 'true';
      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('returns false when TESTING_AUTH_BYPASS is unset', () => {
      setNodeEnv('development');
      delete process.env.TESTING_AUTH_BYPASS;
      expect(isAuthBypassEnabled()).toBe(false);
    });

    it('is not driven by the public NEXT_PUBLIC_TESTING flag', () => {
      setNodeEnv('development');
      delete process.env.TESTING_AUTH_BYPASS;
      process.env.NEXT_PUBLIC_TESTING = 'true';
      expect(isAuthBypassEnabled()).toBe(false);
    });
  });
});
