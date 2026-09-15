import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';

/**
 * Local identity-provider fixture. The applications still run the actual Clerk
 * middleware/SDK: it fetches this JWKS and verifies a signed Bearer session.
 * This proves SDK verification and application authorization, not hosted login.
 * Never import this fixture into either application's runtime.
 *
 * @param {{ organizationId: string, users: Array<{ id: string, email: string, firstName?: string, lastName?: string, member?: boolean }> }} options
 */
export function createClerkFixture({ organizationId, users }) {
  const issuer = 'https://clerk.smoke.test';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const kid = randomUUID();
  const jwks = {
    keys: [
      { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' },
    ],
  };
  const identities = new Map(users.map(user => [user.id, { ...user }]));

  function userPayload(user) {
    const emailId = `idn_${user.id}`;
    return {
      object: 'user',
      id: user.id,
      first_name: user.firstName ?? 'Smoke',
      last_name: user.lastName ?? 'Test',
      username: user.id,
      image_url: '',
      has_image: false,
      primary_email_address_id: emailId,
      email_addresses: [
        {
          object: 'email_address',
          id: emailId,
          email_address: user.email,
          verification: { status: 'verified', strategy: 'email_code' },
          linked_to: [],
        },
      ],
      phone_numbers: [],
      external_accounts: [],
      public_metadata: {},
      private_metadata: {},
      unsafe_metadata: {},
      created_at: 1700000000000,
      updated_at: 1700000000000,
      last_sign_in_at: 1700000000000,
      last_active_at: 1700000000000,
      banned: false,
      locked: false,
    };
  }

  /** @param {{ userId: string, organizationId?: string, expiresInSeconds?: number }} options */
  function token({
    userId,
    organizationId: activeOrganizationId,
    expiresInSeconds = 300,
  }) {
    if (!identities.has(userId)) throw new Error('Unknown smoke identity');
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuer,
      sub: userId,
      sid: `sess_${userId}`,
      iat: now,
      nbf: now - 5,
      exp: now + expiresInSeconds,
      v: 2,
      sts: 'active',
      fva: [0, -1],
      ...(activeOrganizationId
        ? { o: { id: activeOrganizationId, slg: 'smoke', rol: 'member' } }
        : {}),
    };
    const header = { typ: 'JWT', alg: 'RS256', kid };
    const unsigned = `${Buffer.from(JSON.stringify(header)).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
  }

  function reply({ response, status = 200, body }) {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
  }

  /** Return false for endpoints belonging to another provider fixture. */
  function handleRequest(request, response) {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method !== 'GET') return false;
    if (url.pathname === '/v1/jwks') {
      reply({ response, body: jwks });
      return true;
    }
    if (url.pathname === `/v1/organizations/${organizationId}/memberships`) {
      const selected = [
        ...url.searchParams.getAll('user_id'),
        ...url.searchParams.getAll('user_id[]'),
      ];
      const data = [...identities.values()]
        .filter(
          user =>
            user.member && (!selected.length || selected.includes(user.id))
        )
        .map(user => ({
          object: 'organization_membership',
          id: `orgmem_${user.id}`,
          role: 'org:member',
          permissions: [],
          public_metadata: {},
          private_metadata: {},
          created_at: 1700000000000,
          updated_at: 1700000000000,
          organization: {
            object: 'organization',
            id: organizationId,
            name: 'Smoke staff',
            slug: 'smoke',
            public_metadata: {},
            private_metadata: {},
            created_at: 1700000000000,
            updated_at: 1700000000000,
          },
          public_user_data: {
            user_id: user.id,
            first_name: user.firstName ?? 'Smoke',
            last_name: user.lastName ?? 'Test',
            identifier: user.email,
            image_url: '',
            has_image: false,
          },
        }));
      reply({ response, body: { data, total_count: data.length } });
      return true;
    }
    if (url.pathname === '/v1/users') {
      const selected = url.searchParams.getAll('user_id');
      const data = [...identities.values()]
        .filter(user => !selected.length || selected.includes(user.id))
        .map(userPayload);
      reply({ response, body: { data, total_count: data.length } });
      return true;
    }
    if (url.pathname.startsWith('/v1/users/')) {
      const user = identities.get(
        decodeURIComponent(url.pathname.slice('/v1/users/'.length))
      );
      reply({
        response,
        status: user ? 200 : 404,
        body: user
          ? userPayload(user)
          : {
              errors: [
                { code: 'resource_not_found', message: 'User not found' },
              ],
            },
      });
      return true;
    }
    return false;
  }

  function setMembership({ userId, member }) {
    const user = identities.get(userId);
    if (!user) throw new Error('Unknown smoke identity');
    user.member = member;
  }

  return {
    publishableKey: `pk_test_${Buffer.from('clerk.smoke.test$').toString('base64')}`,
    secretKey: 'sk_test_smoke_fixture_only',
    jwks,
    token,
    handleRequest,
    setMembership,
  };
}
