import {
  hasAuthorizedRole,
  ADMIN_ORG_ID,
  AUTHORIZED_ROLES,
} from '@/lib/auth-helpers';

describe('auth-helpers', () => {
  describe('hasAuthorizedRole', () => {
    it('returns true for org:admin role in the allowed org', () => {
      const has = jest.fn(({ role }: { role: string }) => role === 'org:admin');
      expect(hasAuthorizedRole(has, ADMIN_ORG_ID)).toBe(true);
    });

    it('returns false for org:admin role in a different org', () => {
      const has = jest.fn(({ role }: { role: string }) => role === 'org:admin');
      expect(hasAuthorizedRole(has, 'org_attacker_owned')).toBe(false);
    });

    it('does not call has when the active org is not the allowed org', () => {
      const has = jest.fn(() => true);
      hasAuthorizedRole(has, 'org_attacker_owned');
      expect(has).not.toHaveBeenCalled();
    });

    it('returns false for org:customer role', () => {
      const has = jest.fn(
        ({ role }: { role: string }) => role === 'org:customer'
      );
      expect(hasAuthorizedRole(has, ADMIN_ORG_ID)).toBe(false);
    });

    it('returns false when has is undefined', () => {
      expect(hasAuthorizedRole(undefined, ADMIN_ORG_ID)).toBe(false);
    });

    it('returns false when orgId is null', () => {
      const has = jest.fn(() => true);
      expect(hasAuthorizedRole(has, null)).toBe(false);
    });

    it('returns false when orgId is undefined', () => {
      const has = jest.fn(() => true);
      expect(hasAuthorizedRole(has, undefined)).toBe(false);
    });

    it('returns false when has always returns false', () => {
      const has = jest.fn(() => false);
      expect(hasAuthorizedRole(has, ADMIN_ORG_ID)).toBe(false);
    });

    it('calls has with org:admin role', () => {
      const has = jest.fn(() => true);
      hasAuthorizedRole(has, ADMIN_ORG_ID);
      expect(has).toHaveBeenCalledWith({ role: 'org:admin' });
    });
  });

  describe('ADMIN_ORG_ID', () => {
    it('is a Clerk organization ID', () => {
      expect(ADMIN_ORG_ID).toMatch(/^org_/);
    });
  });

  describe('AUTHORIZED_ROLES', () => {
    it('has ADMIN constant', () => {
      expect(AUTHORIZED_ROLES.ADMIN).toBe('org:admin');
    });

    it('has CUSTOMER constant', () => {
      expect(AUTHORIZED_ROLES.CUSTOMER).toBe('org:customer');
    });
  });
});
