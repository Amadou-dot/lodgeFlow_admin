import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expectJson } from './assert-http.mjs';
import { createClerkFixture } from './clerk-fixture.mjs';

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const databaseRequire = createRequire(
  path.join(root, 'packages/database/package.json')
);
const { MongoMemoryReplSet } = databaseRequire('mongodb-memory-server');
const mongoose = databaseRequire('mongoose');
const customerRequire = createRequire(
  path.join(root, 'apps/customer/package.json')
);
const ActualStripe = customerRequire('stripe');
const signingStripe = new ActualStripe('sk_test_smoke_only');
const webhookSecret = `whsec_${randomUUID()}`;
const { default: Cabin } =
  await import('../../packages/database/src/models/Cabin.ts');
const { default: Booking } =
  await import('../../packages/database/src/models/Booking.ts');
const { Experience } =
  await import('../../packages/database/src/models/Experience.ts');
const { default: ExperienceBooking } =
  await import('../../packages/database/src/models/ExperienceBooking.ts');
const { default: ProcessedStripeEvent } =
  await import('../../packages/database/src/models/ProcessedStripeEvent.ts');
const { default: Dining } =
  await import('../../packages/database/src/models/Dining.ts');
const { default: DiningReservation } =
  await import('../../packages/database/src/models/DiningReservation.ts');
const { default: Settings } =
  await import('../../packages/database/src/models/Settings.ts');
const { default: StaffAccess } =
  await import('../../packages/database/src/models/StaffAccess.ts');
const { settingsData } =
  await import('../../packages/database/src/settings-defaults.ts');
const { calculateRefund, getCancellationDeadlines, formatCancellationPolicy } =
  await import('../../apps/customer/lib/cancellation.ts');
const workspace = await mkdtemp(path.join(tmpdir(), 'lodgeflow-http-smoke-'));
const secret = randomUUID();
const clerk = createClerkFixture({
  organizationId: 'smoke_org',
  users: [
    ...[
      'customer',
      'foreign',
      'admin',
      'manager',
      'front_desk',
      'unassigned',
    ].map(name => ({
      id: `smoke_${name}`,
      email: `${name}@example.invalid`,
      member: !['customer', 'foreign'].includes(name),
    })),
    { id: 'smoke_revoked', email: 'revoked@example.invalid', member: false },
  ],
});
const children = [];
const logs = new Map();
const calls = [];
const sessions = new Map();
const refunds = new Map();
let refundFailure = false;
let stripeFailure = false;
let emailFailure = true;
let clerkProfileFailure = false;
let clerkMutationAttempts = 0;
let replica;
let provider;
let completed = false;

function cleanEnvironment() {
  // Explicit allowlist: never inherit app, database, provider, auth-bypass, or proxy secrets.
  const environment = {};
  for (const name of ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'SystemRoot']) {
    if (process.env[name]) environment[name] = process.env[name];
  }
  return environment;
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}
async function freePort() {
  const server = createServer();
  const port = await listen(server);
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function prepareApp(app) {
  const target = path.join(workspace, 'apps', app);
  await cp(path.join(root, 'apps', app), target, {
    recursive: true,
    filter: source =>
      !path
        .relative(path.join(root, 'apps', app), source)
        .split(path.sep)
        .some(
          part =>
            [
              'node_modules',
              'coverage',
              'test-results',
              'playwright-report',
            ].includes(part) ||
            (part.startsWith('.') && part !== '.') ||
            part.startsWith('.env') ||
            part.endsWith('.tsbuildinfo')
        ),
  });
  await symlink(
    path.join(root, 'apps', app, 'node_modules'),
    path.join(target, 'node_modules'),
    'dir'
  );
  for (const name of ['stripe', 'resend']) {
    await cp(
      path.join(root, 'scripts/http-smoke', `${name}.mjs`),
      path.join(target, `smoke-${name}.mjs`)
    );
  }
  const configPath = path.join(target, 'next.config.js');
  const config = await readFile(configPath, 'utf8');
  await writeFile(
    configPath,
    `${config}\n// Disposable harness configuration; source application config is untouched.\nconst originalWebpack = module.exports.webpack;\nmodule.exports.webpack = (config, options) => {\n config = originalWebpack ? originalWebpack(config, options) : config;\n config.resolve.alias = { ...config.resolve.alias, 'stripe$': path.join(__dirname, 'smoke-stripe.mjs'), '__smoke_actual_stripe__$': require.resolve('stripe'), 'resend$': path.join(__dirname, 'smoke-resend.mjs'), '__smoke_actual_resend__$': require.resolve('resend') };\n return config;\n};\n`
  );
  return target;
}
async function startApp({ app, mongoUri, providerUrl }) {
  const cwd = await prepareApp(app);
  const port = await freePort();
  const requireApp = createRequire(
    path.join(root, 'apps', app, 'package.json')
  );
  const child = spawn(
    process.execPath,
    [
      requireApp.resolve('next/dist/bin/next'),
      'dev',
      '--webpack',
      '--hostname',
      'localhost',
      '--port',
      String(port),
    ],
    {
      cwd,
      env: {
        ...cleanEnvironment(),
        NODE_ENV: 'development',
        NEXT_TELEMETRY_DISABLED: '1',
        MONGODB_URI: mongoUri,
        LODGEFLOW_STAFF_ORG_ID: 'smoke_org',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
        CLERK_SECRET_KEY: clerk.secretKey,
        CLERK_API_URL: providerUrl,
        STRIPE_SECRET_KEY: 'sk_test_smoke_only',
        STRIPE_WEBHOOK_SECRET: webhookSecret,
        RESEND_API_KEY: 're_smoke_only',
        NEXT_PUBLIC_APP_URL:
          app === 'customer'
            ? 'https://lodgeflow.app'
            : 'https://admin.lodgeflow.app',
        SMOKE_SECRET: secret,
        SMOKE_PROVIDER_URL: providerUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  children.push(child);
  logs.set(app, '');
  const collect = chunk =>
    logs.set(app, (logs.get(app) + chunk.toString()).slice(-50000));
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(poll);
      reject(new Error(`${app} startup timed out`));
    }, 90000);
    child.once('error', error => {
      clearTimeout(timeout);
      clearInterval(poll);
      reject(error);
    });
    const poll = setInterval(() => {
      if (child.exitCode !== null) {
        clearTimeout(timeout);
        clearInterval(poll);
        reject(new Error(`${app} exited during startup`));
      } else if (/Ready in/.test(logs.get(app))) {
        clearTimeout(timeout);
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
  return `http://localhost:${port}`;
}
function identity(name) {
  const userId = name === 'wrong_org' ? 'smoke_admin' : `smoke_${name}`;
  const organizationId =
    name === 'wrong_org'
      ? 'other_org'
      : ['customer', 'foreign'].includes(name)
        ? undefined
        : 'smoke_org';
  return { authorization: `Bearer ${clerk.token({ userId, organizationId })}` };
}
async function request({ origin, route, identity: name, ...options }) {
  return expectJson({
    url: `${origin}${route}`,
    headers: name ? identity(name) : {},
    ...options,
  });
}
async function expectAuthenticationRedirect({
  origin,
  route,
  method = 'GET',
  body,
  token,
}) {
  const response = await fetch(`${origin}${route}`, {
    method,
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get('location'));
  assert.equal(location.hostname, 'accounts.smoke.test');
  assert.equal(location.pathname, '/sign-in');
  console.log('Verified authentication redirect', location.pathname);
}
let cleanupPromise;
function cleanup() {
  cleanupPromise ??= performCleanup();
  return cleanupPromise;
}
async function performCleanup() {
  for (const child of children) child.kill('SIGTERM');
  await Promise.all(
    children.map(child =>
      child.exitCode !== null
        ? Promise.resolve()
        : new Promise(resolve => {
            const timer = setTimeout(() => {
              child.kill('SIGKILL');
              resolve();
            }, 5000);
            child.once('exit', () => {
              clearTimeout(timer);
              resolve();
            });
          })
    )
  );
  await mongoose.disconnect();
  if (replica) await replica.stop();
  if (provider) {
    provider.closeAllConnections();
    await new Promise(resolve => provider.close(resolve));
  }
  await rm(workspace, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });
try {
  await mkdir(path.join(workspace, 'packages'), { recursive: true });
  await symlink(
    path.join(root, 'packages/database'),
    path.join(workspace, 'packages/database'),
    'dir'
  );
  await symlink(
    path.join(root, 'packages/email'),
    path.join(workspace, 'packages/email'),
    'dir'
  );
  await symlink(
    path.join(root, 'node_modules'),
    path.join(workspace, 'node_modules'),
    'dir'
  );
  await cp(
    path.join(root, 'package.json'),
    path.join(workspace, 'package.json')
  );
  await cp(
    path.join(root, 'pnpm-workspace.yaml'),
    path.join(workspace, 'pnpm-workspace.yaml')
  );
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [
      {
        launchTimeout: 30000,
        args: ['--setParameter', 'enableTestCommands=1'],
      },
    ],
  });
  const mongoUri = replica.getUri('http_smoke');
  await mongoose.connect(mongoUri);
  await Settings.create(settingsData);
  const cabin = await Cabin.create({
    name: 'Smoke Cabin',
    image: 'https://images.unsplash.com/lodgeflow-smoke-cabin.jpg',
    capacity: 4,
    price: 100,
    discount: 0,
    description: 'Isolated smoke fixture',
    status: 'active',
    amenities: [],
  });
  await StaffAccess.create([
    {
      organizationId: 'smoke_org',
      userId: 'smoke_admin',
      role: 'admin',
      updatedBy: 'smoke_setup',
    },
    {
      organizationId: 'smoke_org',
      userId: 'smoke_manager',
      role: 'manager',
      updatedBy: 'smoke_setup',
    },
    {
      organizationId: 'smoke_org',
      userId: 'smoke_front_desk',
      role: 'front_desk',
      updatedBy: 'smoke_setup',
    },
    {
      organizationId: 'smoke_org',
      userId: 'smoke_revoked',
      role: 'admin',
      updatedBy: 'smoke_setup',
    },
  ]);
  provider = createServer(async (incoming, outgoing) => {
    if (
      incoming.url.startsWith('/v1/users') &&
      ['POST', 'PATCH', 'DELETE'].includes(incoming.method)
    ) {
      clerkMutationAttempts++;
    }
    if (
      clerkProfileFailure &&
      incoming.method === 'GET' &&
      incoming.url === '/v1/users/smoke_customer'
    ) {
      outgoing.writeHead(503, { 'content-type': 'application/json' });
      outgoing.end(
        JSON.stringify({
          errors: [
            { code: 'unexpected_error', message: 'Private profile failure' },
          ],
        })
      );
      return;
    }
    if (clerk.handleRequest(incoming, outgoing)) return;
    if (incoming.headers['x-smoke-secret'] !== secret) {
      outgoing.writeHead(403);
      outgoing.end();
      return;
    }
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const payload = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ route: incoming.url, ...payload });
    outgoing.setHeader('content-type', 'application/json');
    if (incoming.url === '/stripe/create') {
      if (stripeFailure) {
        outgoing.writeHead(503);
        outgoing.end('{"error":"injected failure"}');
        return;
      }
      const key = payload.options.idempotencyKey;
      if (!sessions.has(key))
        sessions.set(key, {
          id: `cs_smoke_${sessions.size + 1}`,
          status: 'open',
          url: 'https://checkout.stripe.invalid/smoke',
        });
      outgoing.end(JSON.stringify(sessions.get(key)));
      return;
    }
    if (incoming.url === '/stripe/refund') {
      if (refundFailure) {
        outgoing.writeHead(503);
        outgoing.end('{"error":"injected refund failure"}');
        return;
      }
      const key = payload.options.idempotencyKey;
      if (!refunds.has(key))
        refunds.set(key, {
          id: `re_smoke_${refunds.size + 1}`,
          amount: payload.input.amount,
          status: 'succeeded',
        });
      outgoing.end(JSON.stringify(refunds.get(key)));
      return;
    }
    if (incoming.url === '/stripe/retrieve') {
      outgoing.end(
        JSON.stringify(
          [...sessions.values()].find(session => session.id === payload.input)
        )
      );
      return;
    }
    if (incoming.url === '/resend/send') {
      outgoing.end(
        JSON.stringify(
          emailFailure
            ? {
                data: null,
                error: {
                  name: 'application_error',
                  message: 'Injected email failure',
                },
              }
            : { data: { id: 'email_smoke' }, error: null }
        )
      );
      return;
    }
    outgoing.writeHead(500);
    outgoing.end('{"error":"Unexpected provider operation"}');
  });
  const providerUrl = `http://127.0.0.1:${await listen(provider)}`;
  const customer = await startApp({ app: 'customer', mongoUri, providerUrl });
  const admin = await startApp({ app: 'admin', mongoUri, providerUrl });
  const publicCabins = await request({
    origin: customer,
    route: '/api/cabins',
    status: 200,
  });
  assert.equal(publicCabins.success, true);
  assert.deepEqual(
    publicCabins.data.map(row => row._id),
    [String(cabin._id)]
  );
  const cabinSnapshot = JSON.stringify(await Cabin.findById(cabin._id).lean());
  assert.deepEqual(publicCabins.data, JSON.parse(JSON.stringify([cabin])));
  assert.deepEqual(
    await request({
      origin: customer,
      route: `/api/cabins/${cabin._id}`,
      status: 200,
    }),
    { success: true, data: JSON.parse(JSON.stringify(cabin)) }
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/cabins/availability',
      method: 'POST',
      body: {
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-04',
        guests: 4,
      },
      status: 200,
    }),
    {
      success: true,
      data: [
        {
          ...JSON.parse(JSON.stringify(cabin)),
          isAvailable: true,
          conflictingBookings: [],
        },
      ],
    }
  );
  assert.equal(
    JSON.stringify(await Cabin.findById(cabin._id).lean()),
    cabinSnapshot
  );
  assert.equal(calls.length, 0);
  console.log(
    'PASS cabin list/detail/availability JSON preserves IDs, dates, defaults and virtuals'
  );
  const inactiveCabin = await Cabin.create({
    name: 'Inactive Cabin Fixture',
    image: 'https://images.unsplash.com/lodgeflow-smoke-inactive.jpg',
    capacity: 4,
    price: 120,
    discount: 0,
    description: 'This cabin is not publicly bookable',
    status: 'inactive',
    amenities: [],
  });
  const maintenanceCabin = await Cabin.create({
    name: 'Maintenance Cabin Fixture',
    image: 'https://images.unsplash.com/lodgeflow-smoke-maintenance.jpg',
    capacity: 4,
    price: 130,
    discount: 0,
    description: 'Unavailable during maintenance',
    status: 'maintenance',
    amenities: [],
  });
  const catalogBeforeVisibility = JSON.stringify(
    await Cabin.find().sort({ _id: 1 }).lean()
  );
  for (const hiddenCabin of [inactiveCabin, maintenanceCabin]) {
    assert.deepEqual(
      await request({
        origin: customer,
        route: `/api/cabins/${hiddenCabin._id}/availability`,
        status: 404,
      }),
      { success: false, error: 'Cabin not found' }
    );
  }
  const activePage = await fetch(`${customer}/cabins/${cabin._id}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(activePage.status, 200);
  const activeHtml = await activePage.text();
  assert.ok(activeHtml.includes('Smoke Cabin'));
  assert.match(activeHtml, /application\/ld\+json/);
  const homePage = await fetch(`${customer}/`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(homePage.status, 200);
  const homeHtml = await homePage.text();
  assert.ok(homeHtml.includes('Smoke Cabin'));
  assert.equal(
    homeHtml.includes('Inactive Cabin Fixture'),
    false,
    'homepage must omit inactive cabins'
  );
  assert.equal(
    homeHtml.includes('Maintenance Cabin Fixture'),
    false,
    'homepage must omit maintenance cabins'
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/cabins/availability',
      method: 'POST',
      body: {
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-04',
        guests: 4,
      },
      status: 200,
    }),
    {
      success: true,
      data: [
        {
          ...JSON.parse(JSON.stringify(cabin)),
          isAvailable: true,
          conflictingBookings: [],
        },
      ],
    }
  );
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['find'], errorCode: 2 },
  });
  const failedHome = await fetch(`${customer}/`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
  });
  assert.equal(failedHome.status, 200);
  const failedHomeHtml = await failedHome.text();
  assert.equal(failedHomeHtml.includes('Smoke Cabin'), false);
  assert.equal(failedHomeHtml.includes('failCommand'), false);
  await mongoose.connection.db
    .admin()
    .command({ configureFailPoint: 'failCommand', mode: 'off' });
  assert.equal(
    JSON.stringify(await Cabin.find().sort({ _id: 1 }).lean()),
    catalogBeforeVisibility
  );
  assert.equal(calls.length, 0);
  console.log(
    'PASS public homepage/availability visibility, active page rendering and safe homepage failure'
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: `/api/cabins/${inactiveCabin._id}`,
      status: 404,
    }),
    { success: false, error: 'Cabin not found' }
  );
  const inactivePage = await fetch(`${customer}/cabins/${inactiveCabin._id}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
  });
  const inactiveHtml = await inactivePage.text();
  assert.equal(inactivePage.status, 404, 'inactive cabin page must return 404');
  assert.match(inactiveHtml, /noindex/);
  assert.equal(inactiveHtml.includes('Inactive Cabin Fixture'), false);
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/cabins?maxPrice=0',
      status: 200,
    }),
    { success: true, data: [] }
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/cabins/invalid',
      status: 400,
    }),
    { success: false, error: 'Invalid cabin ID' }
  );
  await Cabin.deleteMany({
    _id: { $in: [inactiveCabin._id, maintenanceCabin._id] },
  });
  assert.equal(
    JSON.stringify(await Cabin.findById(cabin._id).lean()),
    cabinSnapshot
  );
  assert.equal(calls.length, 0);
  console.log('PASS public customer catalog through proxy and route');
  const queryExperienceFields = {
    description: 'Isolated experience query fixture',
    duration: '1 hour',
    difficulty: 'Easy',
    category: 'Nature',
    image: 'https://example.invalid/query-walk.jpg',
    includes: ['Guide'],
    available: ['Monday'],
    ctaText: 'Book now',
    tags: ['forest', 'family'],
    maxParticipants: 4,
  };
  const popularPaidExperience = await Experience.create({
    ...queryExperienceFields,
    name: 'Popular paid walk',
    price: 50,
    isPopular: true,
  });
  const freeQueryExperience = await Experience.create({
    ...queryExperienceFields,
    name: 'Free query walk',
    price: 0,
    isPopular: false,
  });
  const affordableExperience = await Experience.create({
    ...queryExperienceFields,
    name: 'Water outing',
    price: 25,
    isPopular: false,
    difficulty: 'Moderate',
    category: 'Water Sports',
    tags: ['water'],
  });
  const popularPaidId = String(popularPaidExperience._id);
  const freeQueryId = String(freeQueryExperience._id);
  const affordableId = String(affordableExperience._id);
  const experienceCatalogSnapshot = () =>
    Experience.find()
      .select('+reservationVersion')
      .sort({ _id: 1 })
      .lean()
      .then(rows => JSON.stringify(rows));
  const beforeExperienceQueries = await experienceCatalogSnapshot();
  for (const { query, ids } of [
    { query: '', ids: [popularPaidId, freeQueryId, affordableId] },
    { query: '?minPrice=10&maxPrice=40', ids: [affordableId] },
    {
      query: '?category=Nature&difficulty=Easy&isPopular=false&tags=family',
      ids: [freeQueryId],
    },
    { query: '?isPopular=true', ids: [popularPaidId] },
    { query: '?minPrice=40&maxPrice=10', ids: [] },
  ]) {
    const result = await request({
      origin: customer,
      route: `/api/experiences${query}`,
      status: 200,
    });
    assert.equal(result.success, true);
    assert.deepEqual(
      result.data.map(row => row._id),
      ids
    );
    const expected = await Experience.find({ _id: { $in: ids } }).sort({
      isPopular: -1,
      price: 1,
    });
    assert.deepEqual(result, {
      success: true,
      data: JSON.parse(JSON.stringify(expected)),
    });
  }
  const invalidExperienceQuery = await request({
    origin: customer,
    route: '/api/experiences?minPrice=-1',
    status: 400,
  });
  assert.equal(invalidExperienceQuery.success, false);
  assert.match(invalidExperienceQuery.error, /minPrice:/);
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['find'], errorCode: 2 },
  });
  assert.deepEqual(
    await request({ origin: customer, route: '/api/experiences', status: 500 }),
    {
      success: false,
      error: 'Failed to fetch experiences',
    }
  );
  assert.equal(await experienceCatalogSnapshot(), beforeExperienceQueries);
  assert.equal(calls.length, 0);
  console.log(
    'PASS experience catalog filters, sorting, JSON and safe validation/database failures without writes'
  );
  for (const query of ['?maxPrice=0', '?minPrice=0&maxPrice=0']) {
    const result = await request({
      origin: customer,
      route: `/api/experiences${query}`,
      status: 200,
    });
    assert.equal(result.success, true);
    assert.deepEqual(
      result.data.map(row => row._id),
      [freeQueryId]
    );
    assert.equal(result.data[0].price, 0);
  }
  assert.equal(await experienceCatalogSnapshot(), beforeExperienceQueries);
  assert.equal(calls.length, 0);
  await Experience.deleteMany({
    _id: { $in: [popularPaidId, freeQueryId, affordableId] },
  });
  console.log(
    'PASS explicit zero experience price limits return only free listings'
  );
  const queryDiningFields = {
    description: 'Isolated dining query fixture',
    type: 'menu',
    mealType: 'dinner',
    category: 'regular',
    servingTime: { start: '08:00', end: '22:00' },
    minPeople: 1,
    maxPeople: 4,
    image: 'https://example.invalid/query-dining.jpg',
    isAvailable: true,
    isPopular: false,
  };
  const freeQueryDining = await Dining.create({
    ...queryDiningFields,
    name: 'Forest tea',
    price: 0,
    type: 'experience',
    mealType: 'all-day',
    category: 'non-alcoholic',
    dietary: ['vegan', 'gluten-free'],
  });
  const breakfastQueryDining = await Dining.create({
    ...queryDiningFields,
    name: 'Morning menu',
    description: 'Seasonal orchard breakfast',
    price: 15,
    mealType: 'breakfast',
    dietary: ['vegetarian'],
    isPopular: true,
  });
  const dinnerQueryDining = await Dining.create({
    ...queryDiningFields,
    name: 'Evening menu',
    price: 25,
    dietary: ['vegan'],
  });
  const hiddenQueryDining = await Dining.create({
    ...queryDiningFields,
    name: 'Hidden free dining',
    price: 0,
    isAvailable: false,
  });
  const freeDiningId = String(freeQueryDining._id);
  const breakfastDiningId = String(breakfastQueryDining._id);
  const dinnerDiningId = String(dinnerQueryDining._id);
  const diningCatalogSnapshot = () =>
    Dining.find()
      .select('+reservationVersion')
      .sort({ _id: 1 })
      .lean()
      .then(rows => JSON.stringify(rows));
  const beforeDiningQueries = await diningCatalogSnapshot();
  for (const { query, ids } of [
    { query: '', ids: [freeDiningId, breakfastDiningId, dinnerDiningId] },
    {
      query: '?isAvailable=false',
      ids: [freeDiningId, breakfastDiningId, dinnerDiningId],
    },
    { query: '?minPrice=10&maxPrice=20', ids: [breakfastDiningId] },
    {
      query:
        '?type=experience&mealType=all-day&category=non-alcoholic&isPopular=false&dietary=gluten-free',
      ids: [freeDiningId],
    },
    {
      query: '?search=FOREST%7Corchard',
      ids: [freeDiningId, breakfastDiningId],
    },
    { query: '?search=vegan', ids: [freeDiningId, dinnerDiningId] },
    { query: '?isPopular=true', ids: [breakfastDiningId] },
    { query: '?category=unknown', ids: [] },
    { query: '?minPrice=40&maxPrice=10', ids: [] },
  ]) {
    const result = await request({
      origin: customer,
      route: `/api/dining${query}`,
      status: 200,
    });
    assert.equal(result.success, true);
    assert.deepEqual(
      result.data.map(row => row._id),
      ids
    );
    const expected = await Dining.find({ _id: { $in: ids } }).sort({
      mealType: 1,
      type: 1,
      name: 1,
    });
    assert.deepEqual(result, {
      success: true,
      data: JSON.parse(JSON.stringify(expected)),
    });
  }
  const invalidDiningQuery = await request({
    origin: customer,
    route: '/api/dining?minPrice=-1',
    status: 400,
  });
  assert.equal(invalidDiningQuery.success, false);
  assert.match(invalidDiningQuery.error, /minPrice:/);
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['find'], errorCode: 2 },
  });
  assert.deepEqual(
    await request({ origin: customer, route: '/api/dining', status: 500 }),
    { success: false, message: 'Failed to fetch dining options' }
  );
  assert.equal(await diningCatalogSnapshot(), beforeDiningQueries);
  assert.equal(calls.length, 0);
  console.log(
    'PASS dining availability, filters, search, sorting, JSON and safe validation/database failures without writes'
  );
  for (const query of ['?maxPrice=0', '?minPrice=0&maxPrice=0']) {
    const result = await request({
      origin: customer,
      route: `/api/dining${query}`,
      status: 200,
    });
    assert.equal(result.success, true);
    assert.deepEqual(
      result.data.map(row => row._id),
      [freeDiningId]
    );
    assert.equal(result.data[0].price, 0);
  }
  assert.equal(await diningCatalogSnapshot(), beforeDiningQueries);
  assert.equal(calls.length, 0);
  await Dining.deleteMany({
    _id: {
      $in: [
        freeDiningId,
        breakfastDiningId,
        dinnerDiningId,
        hiddenQueryDining._id,
      ],
    },
  });
  console.log(
    'PASS explicit zero dining price limits return only free available listings'
  );
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['find'], errorCode: 2 },
  });
  const databaseFailure = await request({
    origin: customer,
    route: '/api/cabins',
    status: 500,
  });
  assert.deepEqual(databaseFailure, {
    success: false,
    error: 'Failed to fetch cabins',
  });
  await mongoose.connection.db
    .admin()
    .command({ configureFailPoint: 'failCommand', mode: 'off' });
  assert.equal(await Cabin.countDocuments(), 1);
  assert.equal(calls.length, 0);
  console.log(
    'PASS database failure returns safe 500 without provider calls or mutations'
  );

  const selection = {
    cabinId: String(cabin._id),
    checkInDate: '2030-06-01',
    checkOutDate: '2030-06-04',
    numGuests: 2,
    extras: {},
  };
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/bookings',
    method: 'POST',
    body: selection,
  });
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/bookings',
    method: 'POST',
    body: selection,
    token: clerk.token({ userId: 'smoke_customer', expiresInSeconds: -60 }),
  });
  const validToken = clerk.token({ userId: 'smoke_customer' });
  const parts = validToken.split('.');
  parts[1] = Buffer.from(
    JSON.stringify({
      ...JSON.parse(Buffer.from(parts[1], 'base64url')),
      sub: 'smoke_admin',
    })
  ).toString('base64url');
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/bookings',
    method: 'POST',
    body: selection,
    token: parts.join('.'),
  });
  assert.equal(await Booking.countDocuments(), 0);
  const invalid = await request({
    origin: customer,
    route: '/api/bookings',
    identity: 'customer',
    method: 'POST',
    body: { ...selection, numGuests: 0 },
    status: 400,
  });
  assert.equal(invalid.success, false);
  assert.equal(await Booking.countDocuments(), 0);
  const created = await request({
    origin: customer,
    route: '/api/bookings',
    identity: 'customer',
    method: 'POST',
    body: { ...selection, totalPrice: 1, customer: 'attacker' },
    status: 201,
  });
  assert.equal(created.success, true);
  const bookingId = created.data._id;
  assert.deepEqual(created, {
    success: true,
    data: JSON.parse(
      JSON.stringify(await Booking.findById(bookingId).populate('cabin'))
    ),
    message: 'Booking created successfully',
  });
  let persisted = await Booking.findById(bookingId).lean();
  assert.equal(persisted.customer, 'smoke_customer');
  assert.equal(persisted.totalPrice, 300);
  assert.equal(persisted.depositAmount, 75);
  assert.equal(persisted.payments.length, 0);
  const beforeOccupiedAvailability = JSON.stringify(persisted);
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/cabins/availability',
      method: 'POST',
      body: {
        checkInDate: '2030-06-01',
        checkOutDate: '2030-06-04',
        guests: 4,
      },
      status: 200,
    }),
    {
      success: true,
      data: [
        {
          ...JSON.parse(JSON.stringify(cabin)),
          isAvailable: false,
          conflictingBookings: [bookingId],
        },
      ],
    }
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: `/api/cabins/${cabin._id}/availability?startDate=2030-06-01&endDate=2030-07-01`,
      status: 200,
    }),
    {
      success: true,
      data: {
        cabinId: String(cabin._id),
        unavailableDates: [{ start: '2030-06-01', end: '2030-06-04' }],
        queryRange: { start: '2030-06-01', end: '2030-07-01' },
      },
    }
  );
  for (const route of [
    '/api/cabins/invalid/availability',
    `/api/cabins/${cabin._id}/availability?startDate=invalid`,
    `/api/cabins/${cabin._id}/availability?startDate=2030-06-04&endDate=2030-06-01`,
    `/api/cabins/${cabin._id}/availability?startDate=2030-06-01&endDate=2030-06-01`,
  ]) {
    const invalidCalendar = await request({
      origin: customer,
      route,
      status: 400,
    });
    assert.equal(invalidCalendar.success, false);
    assert.equal(typeof invalidCalendar.error, 'string');
  }
  for (const body of [
    null,
    { checkInDate: 'invalid', checkOutDate: '2030-06-04', guests: 4 },
    { checkInDate: 1900000000000, checkOutDate: '2030-06-04', guests: 4 },
    {
      checkInDate: '2030-06-01',
      checkOutDate: '2030-06-04',
      guests: { $gt: 0 },
    },
    { checkInDate: '2030-06-01', checkOutDate: '2030-06-04', guests: 1.5 },
  ]) {
    const invalidAvailability = await request({
      origin: customer,
      route: '/api/cabins/availability',
      method: 'POST',
      body,
      status: 400,
    });
    assert.equal(invalidAvailability.success, false);
    assert.equal(typeof invalidAvailability.error, 'string');
  }
  const malformedAvailability = await fetch(
    `${customer}/api/cabins/availability`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
      signal: AbortSignal.timeout(60000),
    }
  );
  assert.equal(malformedAvailability.status, 400);
  assert.deepEqual(await malformedAvailability.json(), {
    success: false,
    error: 'Invalid JSON body',
  });
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeOccupiedAvailability
  );
  assert.equal(calls.length, 0);
  const conflict = await request({
    origin: customer,
    route: '/api/bookings',
    identity: 'customer',
    method: 'POST',
    body: selection,
    status: 409,
  });
  assert.equal(conflict.success, false);
  assert.equal(await Booking.countDocuments(), 1);
  console.log(
    'PASS booking authentication, validation, trusted pricing and overlap denial'
  );
  const detailRoute = `/api/bookings/${bookingId}`;
  const ownBooking = await request({
    origin: customer,
    route: detailRoute,
    identity: 'customer',
    status: 200,
  });
  assert.equal(ownBooking.data._id, bookingId);
  assert.deepEqual(
    ownBooking.data,
    JSON.parse(
      JSON.stringify(await Booking.findById(bookingId).populate('cabin'))
    )
  );
  assert.equal(ownBooking.data.id, bookingId);
  assert.equal(ownBooking.data.durationText, '3 nights');
  assert.equal(ownBooking.data.paymentStatus, 'unpaid');
  assert.equal(typeof ownBooking.data.checkInDate, 'string');
  assert.equal(ownBooking.data.cabin.discountedPrice, 100);
  const historyRoute = '/api/bookings/history';
  await expectAuthenticationRedirect({ origin: customer, route: historyRoute });
  const history = await request({
    origin: customer,
    route: historyRoute,
    identity: 'customer',
    status: 200,
  });
  const expectedHistory = await Booking.find({ customer: 'smoke_customer' })
    .populate(
      'cabin',
      'name image images capacity price discount description status bedrooms bathrooms size minNights'
    )
    .sort({ createdAt: -1 })
    .lean();
  assert.deepEqual(history, {
    success: true,
    data: JSON.parse(JSON.stringify(expectedHistory)),
  });
  assert.equal(Object.hasOwn(history.data[0], 'durationText'), false);
  assert.equal(Object.hasOwn(history.data[0].cabin, 'discountedPrice'), false);
  assert.equal(Object.hasOwn(history.data[0].cabin, 'amenities'), false);
  assert.deepEqual(
    await request({
      origin: customer,
      route: `${historyRoute}?status=${persisted.status}`,
      identity: 'customer',
      status: 200,
    }),
    history
  );
  for (const query of [
    { route: historyRoute, identity: 'foreign' },
    { route: `${historyRoute}?status=cancelled`, identity: 'customer' },
  ]) {
    assert.deepEqual(
      await request({ origin: customer, status: 200, ...query }),
      {
        success: true,
        data: [],
      }
    );
  }
  // A deleted populated reference must remain null, without dropping the booking.
  const orphan = await Booking.create({
    cabin: new mongoose.Types.ObjectId(),
    customer: 'smoke_foreign',
    checkInDate: new Date('2030-07-01T00:00:00.000Z'),
    checkOutDate: new Date('2030-07-02T00:00:00.000Z'),
    numGuests: 1,
    cabinPrice: 100,
    totalPrice: 100,
  });
  const orphanDetail = await request({
    origin: customer,
    route: `/api/bookings/${orphan._id}`,
    identity: 'foreign',
    status: 200,
  });
  assert.equal(orphanDetail.data.cabin, null);
  const orphanHistory = await request({
    origin: customer,
    route: historyRoute,
    identity: 'foreign',
    status: 200,
  });
  assert.equal(orphanHistory.data.length, 1);
  assert.equal(orphanHistory.data[0]._id, String(orphan._id));
  assert.equal(orphanHistory.data[0].cabin, null);
  const orphanBeforeEmail = JSON.stringify(
    await Booking.findById(orphan._id).lean()
  );
  const callsBeforeOrphanEmail = calls.length;
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/send/confirm',
      identity: 'foreign',
      method: 'POST',
      body: { bookingId: String(orphan._id) },
      status: 404,
    }),
    { error: 'Cabin not found' }
  );
  assert.equal(calls.length, callsBeforeOrphanEmail);
  assert.equal(
    JSON.stringify(await Booking.findById(orphan._id).lean()),
    orphanBeforeEmail
  );
  for (const quote of [
    { checkoutPending: false },
    {
      checkoutPending: true,
      checkoutToken: 'orphan-quote',
      checkoutAmount: 25,
      checkoutTotalPrice: 100,
      checkoutCurrency: 'usd',
    },
    { checkoutPending: true, stripeSessionId: 'cs_orphan' },
  ]) {
    await Booking.updateOne({ _id: orphan._id }, { $set: quote });
    const beforeCheckout = JSON.stringify(
      await Booking.findById(orphan._id).lean()
    );
    const callsBeforeCheckout = calls.length;
    for (const attempt of [
      { identity: 'customer', error: 'Booking not found' },
      { identity: 'foreign', error: 'Cabin not found' },
    ]) {
      assert.deepEqual(
        await request({
          origin: customer,
          route: '/api/payments/create-checkout',
          identity: attempt.identity,
          method: 'POST',
          body: { bookingId: String(orphan._id) },
          status: 404,
        }),
        { success: false, error: attempt.error }
      );
      assert.equal(
        JSON.stringify(await Booking.findById(orphan._id).lean()),
        beforeCheckout
      );
      assert.equal(calls.length, callsBeforeCheckout);
    }
  }
  console.log(
    'PASS missing-cabin checkout denial preserves new/existing quotes with no provider calls'
  );
  await Booking.deleteOne({ _id: orphan._id });
  // Legacy rows predate receipt/checkout fields; lean reads must not add defaults.
  const legacyBooking = {
    _id: new mongoose.Types.ObjectId(),
    cabin: cabin._id,
    customer: 'smoke_foreign',
    checkInDate: new Date('2030-08-01T00:00:00.000Z'),
    checkOutDate: new Date('2030-08-03T00:00:00.000Z'),
    numNights: 2,
    numGuests: 2,
    status: 'confirmed',
    cabinPrice: 200,
    totalPrice: 200,
    isPaid: true,
    observations: null,
    paidAt: null,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-01T00:00:00.000Z'),
  };
  await Booking.collection.insertOne(legacyBooking);
  const legacyHistory = await request({
    origin: customer,
    route: historyRoute,
    identity: 'foreign',
    status: 200,
  });
  assert.equal(legacyHistory.data.length, 1);
  assert.deepEqual(legacyHistory.data[0], {
    ...JSON.parse(JSON.stringify(legacyBooking)),
    cabin: history.data[0].cabin,
  });
  const legacyDetail = await request({
    origin: customer,
    route: `/api/bookings/${legacyBooking._id}`,
    identity: 'foreign',
    status: 200,
  });
  assert.deepEqual(
    legacyDetail.data,
    JSON.parse(
      JSON.stringify(
        await Booking.findById(legacyBooking._id).populate('cabin')
      )
    )
  );
  await Booking.deleteOne({ _id: legacyBooking._id });
  await expectAuthenticationRedirect({ origin: customer, route: detailRoute });
  assert.deepEqual(
    await request({
      origin: customer,
      route: `/api/bookings/${new mongoose.Types.ObjectId()}`,
      identity: 'customer',
      status: 404,
    }),
    { success: false, error: 'Booking not found' }
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/bookings/invalid-id',
      identity: 'customer',
      status: 500,
    }),
    { success: false, error: 'Failed to fetch booking' }
  );
  const beforeReadFailures = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
  const callsBeforeReadFailures = calls.length;
  for (const route of [detailRoute, historyRoute]) {
    await mongoose.connection.db.admin().command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: { failCommands: ['find'], errorCode: 2 },
    });
    assert.deepEqual(
      await request({
        origin: customer,
        route,
        identity: 'customer',
        status: 500,
      }),
      {
        success: false,
        error:
          route === detailRoute
            ? 'Failed to fetch booking'
            : 'Failed to fetch booking history',
      }
    );
    await mongoose.connection.db
      .admin()
      .command({ configureFailPoint: 'failCommand', mode: 'off' });
  }
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeReadFailures
  );
  assert.equal(calls.length, callsBeforeReadFailures);
  console.log(
    'PASS booking read wire contracts, history isolation/filter and missing cabin'
  );
  const beforeDetails = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
  for (const method of ['GET', 'PATCH']) {
    const denied = await request({
      origin: customer,
      route: detailRoute,
      identity: 'foreign',
      method,
      ...(method === 'PATCH' ? { body: { numGuests: 3 } } : {}),
      status: 404,
    });
    assert.deepEqual(denied, { success: false, error: 'Booking not found' });
  }
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeDetails
  );
  const mutationCallsBefore = calls.length;
  await expectAuthenticationRedirect({
    origin: customer,
    route: detailRoute,
    method: 'PATCH',
    body: { numGuests: 3 },
  });
  for (const numGuests of [0, 50]) {
    const rejected = await request({
      origin: customer,
      route: detailRoute,
      identity: 'customer',
      method: 'PATCH',
      body: { numGuests },
      status: 400,
    });
    assert.equal(rejected.success, false);
    assert.equal(typeof rejected.error, 'string');
  }
  for (const id of ['invalid-id', new mongoose.Types.ObjectId().toString()]) {
    assert.deepEqual(
      await request({
        origin: customer,
        route: `/api/bookings/${id}`,
        identity: 'customer',
        method: 'PATCH',
        body: { numGuests: 3 },
        status: 404,
      }),
      { success: false, error: 'Booking not found' }
    );
  }
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['update'], errorCode: 2 },
  });
  assert.deepEqual(
    await request({
      origin: customer,
      route: detailRoute,
      identity: 'customer',
      method: 'PATCH',
      body: { numGuests: 3 },
      status: 500,
    }),
    { success: false, error: 'Failed to update booking' }
  );
  await mongoose.connection.db
    .admin()
    .command({ configureFailPoint: 'failCommand', mode: 'off' });
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeDetails
  );
  assert.equal(calls.length, mutationCallsBefore);
  const updatedDetails = await request({
    origin: customer,
    route: detailRoute,
    identity: 'customer',
    method: 'PATCH',
    body: {
      numGuests: 3,
      totalPrice: 1,
      checkInDate: '2031-01-01',
      checkOutDate: '2031-01-05',
      observations: 'Unsupported edit',
    },
    status: 200,
  });
  assert.equal(updatedDetails.data.numGuests, 3);
  assert.deepEqual(updatedDetails, {
    success: true,
    data: JSON.parse(
      JSON.stringify(await Booking.findById(bookingId).populate('cabin'))
    ),
    message: 'Booking updated successfully',
  });
  assert.equal(updatedDetails.data.checkInDate, created.data.checkInDate);
  assert.equal(updatedDetails.data.checkOutDate, created.data.checkOutDate);
  assert.equal(updatedDetails.data.observations, created.data.observations);
  assert.equal((await Booking.findById(bookingId).lean()).totalPrice, 300);
  console.log(
    'PASS booking detail ownership and allowlisted update persistence'
  );

  const beforePaymentStatus = JSON.stringify(
    await Booking.find().sort({ _id: 1 }).lean()
  );
  const callsBeforePaymentStatus = calls.length;
  const paymentStatusRoute = `/api/payments/${bookingId}`;
  await expectAuthenticationRedirect({
    origin: customer,
    route: paymentStatusRoute,
  });
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/payments/invalid',
  });
  assert.deepEqual(
    await request({
      origin: customer,
      route: `/api/payments/${bookingId.toUpperCase()}`,
      identity: 'customer',
      status: 200,
    }),
    {
      success: true,
      data: {
        isPaid: false,
        depositPaid: false,
        depositAmount: 75,
        totalPrice: 300,
        amountPaid: 0,
        remainingAmount: 300,
      },
    }
  );
  for (const denied of [
    { route: paymentStatusRoute, identity: 'foreign' },
    {
      route: `/api/payments/${new mongoose.Types.ObjectId()}`,
      identity: 'customer',
    },
  ]) {
    assert.deepEqual(
      await request({ origin: customer, ...denied, status: 404 }),
      { success: false, error: 'Booking not found' }
    );
  }
  await mongoose.connection.db.admin().command({
    configureFailPoint: 'failCommand',
    mode: { times: 1 },
    data: { failCommands: ['find'], errorCode: 2 },
  });
  assert.deepEqual(
    await request({
      origin: customer,
      route: paymentStatusRoute,
      identity: 'customer',
      status: 500,
    }),
    { success: false, error: 'Failed to fetch payment status' }
  );
  await mongoose.connection.db
    .admin()
    .command({ configureFailPoint: 'failCommand', mode: 'off' });
  assert.equal(calls.length, callsBeforePaymentStatus);
  assert.equal(
    JSON.stringify(await Booking.find().sort({ _id: 1 }).lean()),
    beforePaymentStatus
  );
  console.log(
    'PASS payment-status fields, ownership, database failure and unchanged state'
  );
  for (const id of ['invalid', '123456789012', '507f1f77bcf86cd7994390az']) {
    assert.deepEqual(
      await request({
        origin: customer,
        route: `/api/payments/${id}`,
        identity: 'customer',
        status: 400,
      }),
      { success: false, error: 'Invalid booking ID' }
    );
  }
  assert.equal(calls.length, callsBeforePaymentStatus);
  assert.equal(
    JSON.stringify(await Booking.find().sort({ _id: 1 }).lean()),
    beforePaymentStatus
  );
  console.log(
    'PASS payment-status invalid IDs rejected without writes/provider calls'
  );

  const beforeInvalidCheckout = JSON.stringify(
    await Booking.find().sort({ _id: 1 }).lean()
  );
  const callsBeforeInvalidCheckout = calls.length;
  for (const body of [
    null,
    [],
    true,
    'booking',
    {},
    { bookingId: 0 },
    { bookingId: 42 },
    { bookingId: { $ne: null } },
  ]) {
    assert.deepEqual(
      await request({
        origin: customer,
        route: '/api/payments/create-checkout',
        identity: 'customer',
        method: 'POST',
        body,
        status: 400,
      }),
      { success: false, error: 'Invalid booking ID' }
    );
  }
  for (const body of ['', '{']) {
    const response = await fetch(`${customer}/api/payments/create-checkout`, {
      method: 'POST',
      headers: { ...identity('customer'), 'content-type': 'application/json' },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(response.status, 400);
    assert.match(
      response.headers.get('content-type') ?? '',
      /application\/json/
    );
    assert.deepEqual(await response.json(), {
      success: false,
      error: 'Invalid JSON body',
    });
  }
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/payments/create-checkout',
    method: 'POST',
    body: { bookingId },
  });
  assert.equal(calls.length, callsBeforeInvalidCheckout);
  assert.equal(
    JSON.stringify(await Booking.find().sort({ _id: 1 }).lean()),
    beforeInvalidCheckout
  );
  console.log(
    'PASS checkout JSON/ID validation and unchanged bookings/provider calls'
  );

  const beforeForeign = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
  const foreign = await request({
    origin: customer,
    route: '/api/payments/create-checkout',
    identity: 'foreign',
    method: 'POST',
    body: { bookingId },
    status: 404,
  });
  const missing = await request({
    origin: customer,
    route: '/api/payments/create-checkout',
    identity: 'foreign',
    method: 'POST',
    body: { bookingId: new mongoose.Types.ObjectId().toString() },
    status: 404,
  });
  assert.deepEqual(foreign, { success: false, error: 'Booking not found' });
  assert.deepEqual(missing, foreign);
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeForeign
  );
  assert.equal(calls.length, 0);
  console.log(
    'PASS #135 identical foreign/missing checkout 404 with no writes/provider calls'
  );

  stripeFailure = true;
  const failedCheckout = await request({
    origin: customer,
    route: '/api/payments/create-checkout',
    identity: 'customer',
    method: 'POST',
    body: { bookingId },
    status: 500,
  });
  assert.deepEqual(failedCheckout, {
    success: false,
    error: 'Failed to create checkout session',
  });
  persisted = await Booking.findById(bookingId).lean();
  assert.equal(persisted.checkoutPending, true);
  assert.equal(persisted.payments.length, 0);
  const quoteToken = persisted.checkoutToken;
  assert.equal(typeof quoteToken, 'string');
  stripeFailure = false;
  const checkout = await request({
    origin: customer,
    route: '/api/payments/create-checkout',
    identity: 'customer',
    method: 'POST',
    body: { bookingId },
    status: 200,
  });
  assert.deepEqual(checkout, {
    success: true,
    data: { url: 'https://checkout.stripe.invalid/smoke' },
  });
  const beforeCheckoutRetry = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
  const retry = await request({
    origin: customer,
    route: '/api/payments/create-checkout',
    identity: 'customer',
    method: 'POST',
    body: { bookingId },
    status: 200,
  });
  assert.deepEqual(retry, checkout);
  persisted = await Booking.findById(bookingId).lean();
  assert.equal(JSON.stringify(persisted), beforeCheckoutRetry);
  assert.equal(persisted.checkoutToken, quoteToken);
  assert.equal(persisted.payments.length, 0);
  assert.equal(sessions.size, 1);
  const beforePendingEstimate = JSON.stringify(persisted);
  const callsBeforePendingEstimate = calls.length;
  const pendingEstimate = await request({
    origin: customer,
    route: `${detailRoute}/refund-estimate`,
    identity: 'customer',
    status: 200,
  });
  assert.equal(pendingEstimate.data.canCancel, false);
  assert.equal(
    pendingEstimate.data.cancelNotAllowedReason,
    'Checkout is active; complete or expire it before cancelling'
  );
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforePendingEstimate
  );
  assert.equal(calls.length, callsBeforePendingEstimate);
  const creations = calls.filter(call => call.route === '/stripe/create');
  assert.equal(creations.length, 2);
  assert.equal(
    creations[0].options.idempotencyKey,
    creations[1].options.idempotencyKey
  );
  assert.deepEqual(creations[1].input, {
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: 7500,
          product_data: { name: 'Smoke Cabin', description: 'Booking deposit' },
        },
        quantity: 1,
      },
    ],
    metadata: {
      bookingId,
      userId: 'smoke_customer',
      isDeposit: 'true',
      quoteToken,
    },
    payment_intent_data: {
      metadata: { bookingId, userId: 'smoke_customer', quoteToken },
    },
    success_url: `https://lodgeflow.app/payments/success?session_id={CHECKOUT_SESSION_ID}&booking_id=${bookingId}`,
    cancel_url: `https://lodgeflow.app/payments/cancel?booking_id=${bookingId}`,
  });
  console.log(
    'PASS checkout provider failure, retained quote, retry/idempotency, customer return origin'
  );

  const beforeEmail = JSON.stringify(await Booking.findById(bookingId).lean());
  const callsBeforeEmail = calls.length;
  await request({
    origin: customer,
    route: '/api/send/confirm',
    identity: 'foreign',
    method: 'POST',
    body: { bookingId },
    status: 403,
  });
  assert.equal(calls.length, callsBeforeEmail);
  const failedEmail = await request({
    origin: customer,
    route: '/api/send/confirm',
    identity: 'customer',
    method: 'POST',
    body: { bookingId },
    status: 500,
  });
  assert.deepEqual(failedEmail, { error: 'Failed to send confirmation email' });
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeEmail
  );
  emailFailure = false;
  const sentEmail = await request({
    origin: customer,
    route: '/api/send/confirm',
    identity: 'customer',
    method: 'POST',
    body: { bookingId },
    status: 200,
  });
  assert.deepEqual(sentEmail, { id: 'email_smoke' });
  assert.equal(calls.at(-1).input.to, 'customer@example.invalid');
  assert.equal(
    calls.at(-1).input.from,
    'LodgeFlow <notifications@lodgeflow.app>'
  );
  assert.equal(calls.at(-1).input.subject, 'Booking Confirmation');
  const confirmationText = calls.at(-1).input.html.replace(/<[^>]+>/g, '');
  assert.ok(confirmationText.includes(`#${bookingId.slice(-8).toUpperCase()}`));
  assert.ok(confirmationText.includes(`Cabin:${cabin.name}`));
  assert.match(confirmationText, /Nightly Rate:\$100\.00/);
  assert.match(confirmationText, /Cabin \(3 nights\):\$300\.00/);
  assert.match(confirmationText, /Extras Subtotal:\$0\.00/);
  assert.match(confirmationText, /Total:\$300\.00/);
  assert.match(confirmationText, /Required Deposit:\$75\.00/);
  assert.match(confirmationText, /Remaining Balance:\$300\.00/);
  assert.ok(!confirmationText.includes('Add-ons:'));
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeEmail
  );
  console.log(
    'PASS confirmation email rendering, missing cabin/ownership denial, provider retry and no booking mutations'
  );

  emailFailure = true;
  const event = {
    id: 'evt_smoke_paid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: persisted.stripeSessionId,
        payment_status: 'paid',
        amount_total: 7500,
        currency: 'usd',
        payment_intent: 'pi_smoke',
        metadata: { bookingId, quoteToken, isDeposit: 'true' },
      },
    },
  };
  const webhook = async (payload, signature) =>
    expectJson({
      url: `${customer}/api/payments/webhook`,
      method: 'POST',
      body: payload,
      status: signature === 'invalid' ? 400 : 200,
      headers: {
        'stripe-signature':
          signature ??
          signingStripe.webhooks.generateTestHeaderString({
            payload: JSON.stringify(payload),
            secret: webhookSecret,
          }),
      },
    });
  assert.deepEqual(await webhook(event, 'invalid'), {
    error: 'Invalid signature',
  });
  assert.equal((await Booking.findById(bookingId).lean()).payments.length, 0);
  const paid = await webhook(event);
  assert.deepEqual(paid, { received: true });
  assert.deepEqual(await webhook(event), paid);
  assert.deepEqual(
    await webhook({ ...event, id: 'evt_smoke_duplicate' }),
    paid
  );
  persisted = await Booking.findById(bookingId).lean();
  assert.equal(persisted.payments.length, 1);
  assert.equal(persisted.payments[0].amount, 75);
  assert.equal(persisted.amountPaid, 75);
  assert.equal(persisted.depositPaid, true);
  assert.equal(persisted.paymentConfirmationSentAt, undefined);
  assert.equal(persisted.checkoutPending, false);
  const beforePaidStatus = JSON.stringify(persisted);
  const callsBeforePaidStatus = calls.length;
  assert.deepEqual(
    await request({
      origin: customer,
      route: paymentStatusRoute,
      identity: 'customer',
      status: 200,
    }),
    {
      success: true,
      data: {
        isPaid: false,
        depositPaid: true,
        depositAmount: 75,
        totalPrice: 300,
        amountPaid: 75,
        remainingAmount: 225,
        paidAt: persisted.paidAt.toISOString(),
        stripeSessionId: persisted.stripeSessionId,
      },
    }
  );
  assert.equal(calls.length, callsBeforePaidStatus);
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforePaidStatus
  );
  assert.equal(calls.at(-1).route, '/resend/send');
  assert.equal(calls.at(-1).input.from, 'LodgeFlow <payments@lodgeflow.app>');
  console.log(
    'PASS real Stripe signature verification, duplicate settlement, email failure preserves durable receipt without delivery flag'
  );
  const receiptSnapshot = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
  const callsBeforeWelcomeAuth = calls.length;
  await expectAuthenticationRedirect({
    origin: customer,
    route: '/api/send/welcome',
    method: 'POST',
    body: { email: 'untrusted@example.invalid' },
  });
  assert.equal(calls.length, callsBeforeWelcomeAuth);
  for (const route of ['/api/send/payment-confirm', '/api/send/welcome']) {
    emailFailure = true;
    const failed = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'POST',
      body: { bookingId },
      status: 500,
    });
    if (route === '/api/send/payment-confirm')
      assert.deepEqual(failed, { error: 'Failed to send confirmation email' });
    else assert.deepEqual(failed, { error: 'Failed to send welcome email' });
    emailFailure = false;
    const sent = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'POST',
      body: {
        bookingId,
        email: 'untrusted@example.invalid',
        firstName: 'Untrusted',
      },
      status: 200,
    });
    assert.deepEqual(sent, { id: 'email_smoke' });
    assert.equal(calls.at(-1).input.to, 'customer@example.invalid');
    assert.equal(
      calls.at(-1).input.from,
      route === '/api/send/payment-confirm'
        ? 'LodgeFlow <payments@lodgeflow.app>'
        : 'LodgeFlow <notifications@lodgeflow.app>'
    );
    if (route === '/api/send/welcome') {
      const welcome = calls.at(-1).input;
      assert.equal(welcome.subject, 'Welcome to LodgeFlow');
      const text = welcome.html.replace(/<[^>]+>/g, '');
      assert.match(text, /join us, Smoke!/);
      assert.equal(text.includes('Untrusted'), false);
    }
  }
  const callsBeforeProfileFailure = calls.length;
  clerkProfileFailure = true;
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/send/welcome',
      identity: 'customer',
      method: 'POST',
      status: 500,
    }),
    { error: 'Failed to send welcome email' }
  );
  clerkProfileFailure = false;
  assert.equal(calls.length, callsBeforeProfileFailure);
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    receiptSnapshot
  );
  console.log(
    'PASS existing customer welcome/payment email failures and retries preserve receipts'
  );

  const multiPayment = await Booking.create({
    cabin: cabin._id,
    customer: 'smoke_customer',
    checkInDate: new Date('2030-09-01T15:00:00.000Z'),
    checkOutDate: new Date('2030-09-04T15:00:00.000Z'),
    numGuests: 1,
    cabinPrice: 300.5,
    totalPrice: 300.5,
    payments: [
      {
        id: 'receipt_first',
        amount: 25,
        method: 'cash',
        receivedAt: new Date(),
      },
      {
        id: 'receipt_latest',
        amount: 75.25,
        method: 'cash',
        receivedAt: new Date(),
      },
    ],
  });
  const multiPaymentId = String(multiPayment._id);
  assert.equal(multiPayment.remainingAmount, 200.25);
  const beforeMultiEmail = JSON.stringify(
    await Booking.findById(multiPaymentId).lean()
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/send/payment-confirm',
      identity: 'customer',
      method: 'POST',
      body: { bookingId: multiPaymentId, amountPaid: 999, isDeposit: false },
      status: 200,
    }),
    { id: 'email_smoke' }
  );
  const paymentEmail = calls.at(-1).input;
  assert.equal(paymentEmail.to, 'customer@example.invalid');
  assert.equal(paymentEmail.subject, 'Payment Confirmation - LodgeFlow');
  const paymentText = paymentEmail.html.replace(/<[^>]+>/g, '');
  assert.match(paymentText, /Amount Paid:\$75\.25/);
  assert.match(paymentText, /Payment Type:Deposit/);
  assert.match(paymentText, /Remaining Balance:\$200\.25/);
  assert.equal(
    JSON.stringify(await Booking.findById(multiPaymentId).lean()),
    beforeMultiEmail
  );

  multiPayment.cabin = new mongoose.Types.ObjectId();
  multiPayment.checkoutPending = true;
  multiPayment.checkoutToken = 'missing-cabin-quote';
  multiPayment.checkoutAmount = 50;
  multiPayment.checkoutTotalPrice = multiPayment.totalPrice;
  multiPayment.checkoutCurrency = 'usd';
  await multiPayment.save();
  const beforeMissingCabin = JSON.stringify(
    await Booking.findById(multiPaymentId).lean()
  );
  const callsBeforeMissingCabin = calls.length;
  assert.deepEqual(
    await request({
      origin: customer,
      route: '/api/send/payment-confirm',
      identity: 'customer',
      method: 'POST',
      body: { bookingId: multiPaymentId },
      status: 404,
    }),
    { error: 'Cabin not found' }
  );
  assert.equal(
    JSON.stringify(await Booking.findById(multiPaymentId).lean()),
    beforeMissingCabin
  );
  const missingCabinEvent = {
    ...event,
    id: 'evt_missing_cabin',
    data: {
      object: {
        ...event.data.object,
        id: 'cs_missing_cabin',
        amount_total: 5000,
        payment_intent: 'pi_missing_cabin',
        metadata: {
          bookingId: multiPaymentId,
          quoteToken: 'missing-cabin-quote',
          isDeposit: 'true',
        },
      },
    },
  };
  assert.deepEqual(await webhook(missingCabinEvent), { received: true });
  assert.deepEqual(await webhook(missingCabinEvent), { received: true });
  const settledMissingCabin = await Booking.findById(multiPaymentId).lean();
  assert.equal(settledMissingCabin.payments.length, 3);
  assert.equal(settledMissingCabin.amountPaid, 150.25);
  assert.equal(settledMissingCabin.remainingAmount, 150.25);
  assert.equal(settledMissingCabin.checkoutPending, false);
  assert.equal(settledMissingCabin.paymentConfirmationSentAt, undefined);
  assert.equal(calls.length, callsBeforeMissingCabin);
  await Booking.deleteOne({ _id: multiPayment._id });
  console.log(
    'PASS payment email receipt balance, missing cabin denial and durable webhook settlement'
  );

  const beforeCancel = JSON.stringify(await Booking.findById(bookingId).lean());
  const estimateRoute = `${detailRoute}/refund-estimate`;
  const estimate = await request({
    origin: customer,
    route: estimateRoute,
    identity: 'customer',
    status: 200,
  });
  const estimateBooking = await Booking.findById(bookingId);
  const estimateSettings = await Settings.findOne();
  assert.deepEqual(estimate, {
    success: true,
    data: {
      estimate: calculateRefund(estimateBooking, estimateSettings),
      deadlines: JSON.parse(
        JSON.stringify(
          getCancellationDeadlines(
            estimateBooking.checkInDate,
            estimateSettings.cancellationPolicy
          )
        )
      ),
      policyDescription: formatCancellationPolicy(
        estimateSettings.cancellationPolicy
      ),
      canCancel: true,
    },
  });
  assert.equal(estimate.data.estimate.refundAmount, 75);
  await expectAuthenticationRedirect({
    origin: customer,
    route: estimateRoute,
  });
  const callsBeforeEstimateDenials = calls.length;
  for (const route of [
    estimateRoute,
    `/api/bookings/${new mongoose.Types.ObjectId()}/refund-estimate`,
  ]) {
    assert.deepEqual(
      await request({
        origin: customer,
        route,
        identity: 'foreign',
        status: 404,
      }),
      {
        success: false,
        error: 'Booking not found',
      }
    );
  }
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeCancel
  );
  assert.equal(calls.length, callsBeforeEstimateDenials);
  const refundCallsBefore = calls.filter(
    call => call.route === '/stripe/refund'
  ).length;
  await request({
    origin: customer,
    route: detailRoute,
    identity: 'foreign',
    method: 'DELETE',
    status: 404,
  });
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    beforeCancel
  );
  assert.equal(
    calls.filter(call => call.route === '/stripe/refund').length,
    refundCallsBefore
  );
  refundFailure = true;
  const pendingCancellation = await request({
    origin: customer,
    route: detailRoute,
    identity: 'customer',
    method: 'DELETE',
    status: 200,
  });
  assert.equal(pendingCancellation.success, true);
  assert.equal(pendingCancellation.data.booking.status, 'cancelled');
  assert.equal(pendingCancellation.data.refund.status, 'pending');
  assert.equal(
    pendingCancellation.data.refund.error,
    'Injected Stripe failure'
  );
  assert.equal(pendingCancellation.data.refund.amount, 75);
  assert.deepEqual(
    pendingCancellation.data.booking,
    JSON.parse(
      JSON.stringify(await Booking.findById(bookingId).populate('cabin'))
    )
  );
  const cancelledEstimate = await request({
    origin: customer,
    route: estimateRoute,
    identity: 'customer',
    status: 200,
  });
  assert.equal(cancelledEstimate.data.canCancel, false);
  assert.equal(cancelledEstimate.data.estimate.refundAmount, 0);
  assert.equal(cancelledEstimate.data.deadlines.fullRefundDeadline, null);
  assert.equal(cancelledEstimate.data.deadlines.partialRefundDeadline, null);
  persisted = await Booking.findById(bookingId).lean();
  assert.equal(persisted.refundAmount ?? 0, 0);
  assert.equal(persisted.cancellationRefunds[0].amount, 75);
  refundFailure = false;
  const recoveredCancellation = await request({
    origin: customer,
    route: detailRoute,
    identity: 'customer',
    method: 'DELETE',
    status: 200,
  });
  assert.equal(recoveredCancellation.data.refund.status, 'pending');
  assert.equal(recoveredCancellation.data.refund.error, undefined);
  assert.deepEqual(
    recoveredCancellation.data.booking,
    JSON.parse(
      JSON.stringify(await Booking.findById(bookingId).populate('cabin'))
    )
  );
  await request({
    origin: customer,
    route: detailRoute,
    identity: 'customer',
    method: 'DELETE',
    status: 200,
  });
  const refundCalls = calls.filter(call => call.route === '/stripe/refund');
  assert.equal(refundCalls.length, 2);
  assert.equal(
    refundCalls[0].options.idempotencyKey,
    refundCalls[1].options.idempotencyKey
  );
  assert.equal(refundCalls[1].input.amount, 7500);
  assert.equal(refunds.size, 1);
  const refundEvent = {
    id: 'evt_smoke_refund',
    type: 'charge.refunded',
    data: { object: { payment_intent: 'pi_smoke', amount_refunded: 7500 } },
  };
  await webhook(refundEvent);
  await webhook({
    ...refundEvent,
    id: 'evt_smoke_refund_old',
    data: { object: { payment_intent: 'pi_smoke', amount_refunded: 5000 } },
  });
  persisted = await Booking.findById(bookingId).lean();
  assert.equal(persisted.refundAmount, 75);
  assert.equal(persisted.payments[0].refundedAmount, 75);
  assert.equal(persisted.refundStatus, 'full');
  assert.equal(persisted.payments.length, 1);
  console.log(
    'PASS refund ownership, received-money cap, provider failure/retry, pending accounting and out-of-order signed completion'
  );

  await expectAuthenticationRedirect({ origin: admin, route: '/api/settings' });
  for (const name of ['wrong_org', 'unassigned', 'revoked']) {
    const denied = await request({
      origin: admin,
      route: '/api/settings',
      identity: name,
      status: 403,
    });
    assert.equal(denied.success, false);
  }
  const read = await request({
    origin: admin,
    route: '/api/settings',
    identity: 'front_desk',
    status: 200,
  });
  assert.equal(read.success, true);
  assert.equal(read.data.breakfastPrice, 15);
  clerk.setMembership({ userId: 'smoke_front_desk', member: false });
  await request({
    origin: admin,
    route: '/api/settings',
    identity: 'front_desk',
    status: 403,
  });
  clerk.setMembership({ userId: 'smoke_front_desk', member: true });
  const beforeDenied = JSON.stringify(await Settings.findOne().lean());
  const deniedWrite = await request({
    origin: admin,
    route: '/api/settings',
    identity: 'front_desk',
    method: 'PUT',
    body: { breakfastPrice: 19 },
    status: 403,
  });
  assert.equal(deniedWrite.success, false);
  assert.equal(JSON.stringify(await Settings.findOne().lean()), beforeDenied);
  const updated = await request({
    origin: admin,
    route: '/api/settings',
    identity: 'admin',
    method: 'PUT',
    body: { breakfastPrice: 19 },
    status: 200,
  });
  assert.equal(updated.success, true);
  assert.equal(updated.data.breakfastPrice, 19);
  assert.equal((await Settings.findOne().lean()).breakfastPrice, 19);
  const audits = await mongoose.connection
    .collection('auditlogs')
    .find({ action: 'settings.update' })
    .toArray();
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actor, 'smoke_admin');
  assert.equal(audits[0].actorRole, 'admin');
  assert.equal(audits[0].organizationId, 'smoke_org');
  assert.equal(audits[0].resourceId, 'global');
  assert.deepEqual(audits[0].before, { breakfastPrice: 15 });
  assert.deepEqual(audits[0].after, { breakfastPrice: 19 });
  console.log(
    'PASS admin proxy org boundary, current membership, assignment, role permission, allowed write and audit'
  );
  const bulkCabin = await Cabin.create({
    name: 'Bulk deletion fixture',
    description: 'Private bulk fixture description',
    image: 'https://example.invalid/bulk-cabin.jpg',
    capacity: 2,
    price: 200,
  });
  const missingBulkCabinId = new mongoose.Types.ObjectId();
  const bulkBooking = await Booking.create({
    cabin: missingBulkCabinId,
    customer: 'smoke_customer',
    checkInDate: new Date('2040-06-01'),
    checkOutDate: new Date('2040-06-03'),
    numNights: 2,
    numGuests: 1,
    cabinPrice: 200,
    totalPrice: 400,
    status: 'confirmed',
  });
  const bulkIds = [String(missingBulkCabinId), String(bulkCabin._id)];
  const bulkState = async () =>
    JSON.stringify({
      cabins: await Cabin.find({ _id: { $in: bulkIds } }).lean(),
      booking: await Booking.findById(bulkBooking._id).lean(),
      audits: await mongoose.connection
        .collection('auditlogs')
        .find({ resourceId: { $in: bulkIds } })
        .toArray(),
    });
  const beforeBulkDenial = await bulkState();
  await request({
    origin: admin,
    route: '/api/cabins/bulk',
    identity: 'front_desk',
    method: 'POST',
    body: { action: 'delete', ids: bulkIds },
    status: 403,
  });
  assert.equal(await bulkState(), beforeBulkDenial);
  const bulkConflict = await request({
    origin: admin,
    route: '/api/cabins/bulk',
    identity: 'manager',
    method: 'POST',
    body: { action: 'delete', ids: bulkIds },
    status: 409,
  });
  assert.deepEqual(bulkConflict, {
    success: false,
    error: 'Cannot delete cabins with active bookings: Unknown',
  });
  assert.equal(await bulkState(), beforeBulkDenial);
  bulkBooking.status = 'checked-out';
  await bulkBooking.save();
  const bulkDeleted = await request({
    origin: admin,
    route: '/api/cabins/bulk',
    identity: 'manager',
    method: 'POST',
    body: { action: 'delete', ids: bulkIds },
    status: 200,
  });
  assert.deepEqual(bulkDeleted, { success: true, data: { deletedCount: 1 } });
  assert.equal(await Cabin.countDocuments({ _id: { $in: bulkIds } }), 0);
  assert.equal(await Booking.countDocuments({ _id: bulkBooking._id }), 1);
  const bulkAudit = await mongoose.connection
    .collection('auditlogs')
    .find({ resourceId: String(bulkCabin._id) })
    .toArray();
  assert.equal(bulkAudit.length, 1);
  assert.equal(bulkAudit[0].actor, 'smoke_manager');
  assert.equal(bulkAudit[0].actorRole, 'manager');
  assert.equal(bulkAudit[0].action, 'cabin.delete');
  assert.equal(bulkAudit[0].before.description, '[redacted]');
  console.log(
    'PASS bulk cabin deletion preserves missing-reference denial, role checks, history, counts and audit attribution'
  );
  const beforeAdminEmailBookings = JSON.stringify(
    await Booking.find().sort({ _id: 1 }).lean()
  );
  for (const route of ['/api/send/confirm', '/api/send/welcome']) {
    const body = {
      firstName: 'Smoke',
      email: 'customer@example.invalid',
      bookingData: created.data,
      cabinData: created.data.cabin,
    };
    const countBefore = calls.length;
    await request({
      origin: admin,
      route,
      identity: 'unassigned',
      method: 'POST',
      body,
      status: 403,
    });
    assert.equal(calls.length, countBefore);
    if (route === '/api/send/welcome') {
      for (const identity of ['manager', 'front_desk']) {
        await request({
          origin: admin,
          route,
          identity,
          method: 'POST',
          status: 403,
        });
      }
      assert.equal(calls.length, countBefore);
      console.log(
        'PASS admin welcome remains administrator-only before body parsing'
      );
      for (const invalid of [
        { body: undefined, error: 'Invalid welcome email data' },
        {
          body: { ...body, email: ['other@example.invalid'] },
          error: 'Invalid email address',
        },
        {
          body: { ...body, firstName: {} },
          error: 'Invalid welcome email data',
        },
      ]) {
        assert.deepEqual(
          await request({
            origin: admin,
            route,
            identity: 'admin',
            method: 'POST',
            body: invalid.body,
            status: 400,
          }),
          { error: invalid.error }
        );
        assert.equal(calls.length, countBefore);
      }
    }
    emailFailure = true;
    const failed = await request({
      origin: admin,
      route,
      identity: 'admin',
      method: 'POST',
      body,
      status: 500,
    });
    if (route === '/api/send/welcome')
      assert.deepEqual(failed, { error: 'Failed to send welcome email' });
    else assert.equal(failed.error.message, 'Injected email failure');
    emailFailure = false;
    const sent = await request({
      origin: admin,
      route,
      identity: 'admin',
      method: 'POST',
      body,
      status: 200,
    });
    assert.deepEqual(sent, { id: 'email_smoke' });
    assert.equal(calls.at(-1).input.to, 'customer@example.invalid');
    assert.equal(
      calls.at(-1).input.from,
      'LodgeFlow <notifications@lodgeflow.app>'
    );
    if (route === '/api/send/welcome') {
      const welcome = calls.at(-1).input;
      assert.equal(welcome.subject, 'Welcome to LodgeFlow');
      assert.match(welcome.html.replace(/<[^>]+>/g, ''), /join us, Smoke!/);
      const beforeLimit = calls.length;
      const limited = await request({
        origin: admin,
        route,
        identity: 'admin',
        method: 'POST',
        body,
        status: 429,
      });
      assert.equal(limited.success, false);
      assert.equal(limited.error, 'Too many requests. Please try again later.');
      assert.ok(limited.retryAfter > 0 && limited.retryAfter <= 60);
      assert.equal(calls.length, beforeLimit);
    }
  }
  assert.equal(
    JSON.stringify(await Booking.find().sort({ _id: 1 }).lean()),
    beforeAdminEmailBookings
  );
  console.log(
    'PASS existing admin email authorization, failure and success contracts'
  );
  const callsBeforeCustomerLimit = calls.length;
  const clerkMutationsBeforeCustomerLimit = clerkMutationAttempts;
  for (let attempt = 0; attempt < 10; attempt++) {
    const invalidCustomer = await request({
      origin: admin,
      route: '/api/customers',
      identity: 'admin',
      method: 'POST',
      body: {},
      status: 400,
    });
    assert.equal(invalidCustomer.success, false);
  }
  const customerLimit = await request({
    origin: admin,
    route: '/api/customers',
    identity: 'admin',
    method: 'POST',
    body: {},
    status: 429,
  });
  assert.equal(
    customerLimit.error,
    'Too many requests. Please try again later.'
  );
  assert.ok(customerLimit.retryAfter > 0 && customerLimit.retryAfter <= 60);
  assert.equal(calls.length, callsBeforeCustomerLimit);
  assert.equal(clerkMutationAttempts, clerkMutationsBeforeCustomerLimit);
  console.log(
    'PASS customer creation keeps its separate ten-request limit without Clerk mutation attempts or email/payment calls'
  );

  const guestDining = await Dining.create({
    name: 'Guest operation dinner',
    description: 'Isolated mutation fixture',
    type: 'menu',
    mealType: 'dinner',
    price: 25,
    servingTime: { start: '17:00', end: '21:00' },
    maxPeople: 4,
    category: 'regular',
    image: 'https://example.invalid/guest-dinner.jpg',
  });
  const guestExperience = await Experience.create({
    name: 'Guest operation hike',
    description: 'Isolated mutation fixture',
    price: 37.5,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Outdoor',
    image: 'https://example.invalid/guest-hike.jpg',
    available: ['Monday'],
    includes: [],
    ctaText: 'Book now',
    maxParticipants: 4,
  });
  for (const resource of [
    {
      kind: 'dining',
      route: '/api/dining-reservations',
      catalog: Dining,
      model: DiningReservation,
      listing: guestDining,
      countKey: 'numGuests',
      input: { diningId: String(guestDining._id), time: '18:00', numGuests: 2 },
    },
    {
      kind: 'experience',
      route: '/api/experience-bookings',
      catalog: Experience,
      model: ExperienceBooking,
      listing: guestExperience,
      countKey: 'numParticipants',
      input: {
        experienceId: String(guestExperience._id),
        timeSlot: '18:00',
        numParticipants: 2,
      },
    },
  ]) {
    const providerCount = calls.length;
    const operationDate = '2030-07-01T18:00:00.000Z';
    await expectAuthenticationRedirect({
      origin: customer,
      route: resource.route,
      method: 'POST',
      body: { ...resource.input, date: operationDate },
    });
    const saved = await request({
      origin: customer,
      route: resource.route,
      identity: 'customer',
      method: 'POST',
      status: 201,
      body: {
        ...resource.input,
        date: operationDate,
        customer: 'smoke_foreign',
        totalPrice: 0,
        isPaid: true,
        status: 'confirmed',
      },
    });
    assert.equal(saved.success, true);
    assert.equal(typeof saved.data._id, 'string');
    assert.equal(saved.data[resource.kind]._id, String(resource.listing._id));
    assert.equal(saved.data.customer, 'smoke_customer');
    assert.equal(saved.data.date, operationDate);
    assert.equal(saved.data.totalPrice, resource.listing.price * 2);
    assert.equal(saved.data.status, 'pending');
    assert.equal(saved.data.isPaid, false);
    assert.deepEqual(saved.data.receipts, []);
    const route = `${resource.route}/${saved.data._id}`;
    const snapshot = async () =>
      JSON.stringify(
        await Promise.all([
          resource.model.findById(saved.data._id).lean(),
          resource.catalog
            .findById(resource.listing._id)
            .select('+reservationVersion')
            .lean(),
        ])
      );
    const beforeDenied = await snapshot();
    for (const method of ['PATCH', 'DELETE']) {
      for (const attempt of [
        { route, identity: 'foreign' },
        {
          route: `${resource.route}/${new mongoose.Types.ObjectId()}`,
          identity: 'customer',
        },
      ]) {
        const denied = await request({
          origin: customer,
          ...attempt,
          method,
          status: 404,
          body: { specialRequests: ['Denied'] },
        });
        assert.deepEqual(denied, {
          success: false,
          error: 'Reservation not found',
        });
      }
    }
    assert.equal(await snapshot(), beforeDenied);
    const edited = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'PATCH',
      status: 200,
      body: {
        [resource.countKey]: 3,
        specialRequests: ['Window please'],
        customer: 'smoke_foreign',
        totalPrice: 0,
      },
    });
    assert.equal(edited.message, 'Reservation updated successfully');
    assert.equal(edited.data.customer, 'smoke_customer');
    assert.equal(edited.data[resource.countKey], 3);
    assert.equal(edited.data.totalPrice, resource.listing.price * 3);
    assert.deepEqual(edited.data.specialRequests, ['Window please']);
    const listingId = String(resource.listing._id);
    const catalogPaths =
      resource.kind === 'dining'
        ? ['/api/dining', `/api/dining/${listingId}`]
        : [`/api/experiences/${listingId}`];
    for (const catalogPath of catalogPaths) {
      const deletePath =
        catalogPath === '/api/dining'
          ? `${catalogPath}?id=${listingId}`
          : catalogPath;
      const beforeCatalogDenied = await snapshot();
      for (const method of ['PUT', 'DELETE']) {
        const denied = await request({
          origin: admin,
          route: method === 'PUT' ? catalogPath : deletePath,
          identity: 'front_desk',
          method,
          status: 403,
          body: { _id: listingId, name: 'Forbidden edit' },
        });
        assert.equal(denied.success, false);
      }
      const conflict = await request({
        origin: admin,
        route: catalogPath,
        identity: 'admin',
        method: 'PUT',
        status: 409,
        body: {
          _id: listingId,
          name: 'Must roll back',
          [resource.kind === 'dining' ? 'maxPeople' : 'maxParticipants']: 2,
        },
      });
      assert.equal(
        conflict.error,
        'Capacity cannot be reduced below existing reservations'
      );
      assert.equal(await snapshot(), beforeCatalogDenied);
      const beforeReservation = JSON.stringify(
        await resource.model.findById(saved.data._id).lean()
      );
      const catalogEdited = await request({
        origin: admin,
        route: catalogPath,
        identity: 'admin',
        method: 'PUT',
        status: 200,
        body: {
          _id: catalogPath === '/api/dining' ? listingId : 'ignored-body-id',
          name: 'Renamed catalog listing',
          price: 12.5,
          reservationVersion: 999999,
          createdAt: '2000-01-01T00:00:00.000Z',
        },
      });
      assert.equal(catalogEdited.success, true);
      assert.equal(catalogEdited.data._id, listingId);
      assert.equal(catalogEdited.data.price, 12.5);
      assert.equal(catalogEdited.data.isPopular, false);
      assert.equal(
        catalogEdited.message,
        resource.kind === 'dining'
          ? 'Dining item updated successfully'
          : undefined
      );
      const catalogRow = await resource.catalog
        .findById(listingId)
        .select('+reservationVersion')
        .lean();
      assert.equal(catalogRow.name, 'Renamed catalog listing');
      assert.equal(catalogRow.price, 12.5);
      assert.notEqual(catalogRow.reservationVersion, 999999);
      assert.equal(
        catalogRow.createdAt.toISOString(),
        resource.listing.createdAt.toISOString()
      );
      assert.equal(
        JSON.stringify(await resource.model.findById(saved.data._id).lean()),
        beforeReservation
      );
    }
    const cancelled = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'DELETE',
      status: 200,
      body: { [resource.countKey]: 99, date: 'invalid' },
    });
    assert.equal(cancelled.message, 'Reservation cancelled successfully');
    assert.equal(cancelled.data.status, 'cancelled');
    assert.equal(cancelled.data[resource.countKey], 3);
    assert.equal(cancelled.data.date, operationDate);
    assert.equal(cancelled.data.totalPrice, resource.listing.price * 3);
    assert.deepEqual(cancelled.data.specialRequests, ['Window please']);
    assert.deepEqual(cancelled.data.receipts, []);
    const beforeRepeat = await snapshot();
    const repeated = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'DELETE',
      status: 400,
    });
    assert.deepEqual(repeated, {
      success: false,
      error: 'This reservation can no longer be changed',
    });
    assert.equal(await snapshot(), beforeRepeat);
    for (const catalogPath of catalogPaths) {
      const deletePath =
        catalogPath === '/api/dining'
          ? `${catalogPath}?id=${listingId}`
          : catalogPath;
      const beforeHistoryDenied = await snapshot();
      const historyDenied = await request({
        origin: admin,
        route: deletePath,
        identity: 'admin',
        method: 'DELETE',
        status: 409,
      });
      assert.equal(
        historyDenied.error,
        'Cannot delete a listing referenced by reservation history'
      );
      assert.equal(await snapshot(), beforeHistoryDenied);
      const unused = await resource.catalog.create({
        ...resource.listing.toObject(),
        _id: new mongoose.Types.ObjectId(),
      });
      const unusedId = String(unused._id);
      const removed = await request({
        origin: admin,
        route:
          catalogPath === '/api/dining'
            ? `${catalogPath}?id=${unusedId}`
            : catalogPath.replace(listingId, unusedId),
        identity: 'admin',
        method: 'DELETE',
        status: 200,
      });
      assert.deepEqual(removed, {
        success: true,
        data: null,
        message:
          resource.kind === 'dining'
            ? 'Dining item deleted successfully'
            : 'Experience deleted successfully',
      });
      assert.equal(await resource.catalog.findById(unusedId), null);
      assert.equal(await snapshot(), beforeHistoryDenied);
    }
    const staffRow = await resource.model.create({
      [resource.kind]: listingId,
      customer: 'smoke_customer',
      date: new Date(operationDate),
      [resource.countKey]: 2,
      ...(resource.kind === 'dining'
        ? { time: '18:00' }
        : { timeSlot: '18:00' }),
      totalPrice: 25,
    });
    const staffId = String(staffRow._id);
    const staffRoute = `${resource.route}/${staffId}`;
    const staffSnapshot = async () =>
      JSON.stringify(
        await Promise.all([
          resource.model.findById(staffId).lean(),
          resource.catalog
            .findById(listingId)
            .select('+reservationVersion')
            .lean(),
          mongoose.connection
            .collection('auditlogs')
            .find({ resourceId: staffId })
            .toArray(),
        ])
      );
    const beforeStaffDenied = await staffSnapshot();
    for (const attempt of [
      { identity: 'unassigned', status: 403, body: { status: 'confirmed' } },
      {
        identity: 'front_desk',
        status: 400,
        body: { expectedStatus: 'pending', status: 'confirmed', totalPrice: 0 },
      },
      {
        identity: 'front_desk',
        status: 409,
        body: { expectedStatus: 'unknown', status: 'unknown' },
      },
    ]) {
      const rejected = await request({
        origin: admin,
        route: staffRoute,
        method: 'PATCH',
        ...attempt,
      });
      assert.equal(rejected.success, false);
      assert.equal(await staffSnapshot(), beforeStaffDenied);
    }
    const details = await request({
      origin: admin,
      route: staffRoute,
      identity: 'front_desk',
      status: 200,
    });
    assert.equal(details.data.reservation._id, staffId);
    assert.equal(details.data.reservation[resource.kind]._id, listingId);
    assert.deepEqual(details.data.allowedStatuses, ['confirmed', 'cancelled']);
    assert.equal(await staffSnapshot(), beforeStaffDenied);
    const confirmed = await request({
      origin: admin,
      route: staffRoute,
      identity: 'front_desk',
      method: 'PATCH',
      status: 200,
      body: { expectedStatus: 'pending', status: 'confirmed' },
    });
    assert.deepEqual(confirmed, {
      success: true,
      data: JSON.parse(JSON.stringify(await resource.model.findById(staffId))),
    });
    assert.equal(confirmed.data.status, 'confirmed');
    assert.equal(confirmed.data.totalPrice, 25);
    assert.deepEqual(confirmed.data.receipts, []);
    const statusAudits = await mongoose.connection
      .collection('auditlogs')
      .find({ resourceId: staffId })
      .toArray();
    assert.equal(statusAudits.length, 1);
    assert.equal(statusAudits[0].actor, 'smoke_front_desk');
    assert.equal(statusAudits[0].actorRole, 'front_desk');
    assert.equal(statusAudits[0].organizationId, 'smoke_org');
    assert.equal(
      statusAudits[0].action,
      resource.kind === 'dining'
        ? 'dining_reservation.status_change'
        : 'experience_booking.status_change'
    );
    assert.deepEqual(statusAudits[0].before, { status: 'pending' });
    assert.deepEqual(statusAudits[0].after, { status: 'confirmed' });
    const noOp = await request({
      origin: admin,
      route: staffRoute,
      identity: 'front_desk',
      method: 'PATCH',
      status: 200,
      body: { expectedStatus: 'confirmed', status: 'confirmed' },
    });
    assert.deepEqual(noOp, confirmed);
    assert.deepEqual(
      await mongoose.connection
        .collection('auditlogs')
        .find({ resourceId: staffId })
        .toArray(),
      statusAudits
    );
    const beforeStale = await staffSnapshot();
    const stale = await request({
      origin: admin,
      route: staffRoute,
      identity: 'front_desk',
      method: 'PATCH',
      status: 409,
      body: { expectedStatus: 'pending', status: 'cancelled' },
    });
    assert.deepEqual(stale, {
      success: false,
      error: 'Reservation changed; refresh and try again',
    });
    assert.equal(await staffSnapshot(), beforeStale);
    assert.equal(calls.length, providerCount);
  }
  console.log(
    'PASS guest reservation create/update/cancel, owner filters, persisted selections and transaction rollback without provider calls'
  );
  console.log(
    'PASS admin catalog edits/deletion: permissions, path IDs, partial updates, capacity rollback and cancelled history without provider calls'
  );
  console.log(
    'PASS staff reservation detail/status: permissions, strict payloads, stale-state rollback, no-op retries and exact audit attribution'
  );

  const experienceFields = {
    name: 'Smoke Kayak',
    price: 37.5,
    duration: '2 hours',
    difficulty: 'Easy',
    category: 'Water',
    description: 'Isolated experience fixture',
    image: 'https://example.invalid/kayak.jpg',
    includes: ['Guide', 'Safety gear'],
    available: ['Monday'],
    ctaText: 'Book now',
    location: 'North dock',
    whatToBring: ['Water', 'Sunscreen'],
  };
  const experience = await Experience.create(experienceFields);
  const experienceBooking = await ExperienceBooking.create({
    experience: experience._id,
    customer: 'smoke_customer',
    date: new Date('2030-06-03T15:00:00Z'),
    timeSlot: '15:00',
    numParticipants: 2,
    totalPrice: 75,
    checkout: {
      token: 'experience-quote',
      amountCents: 7500,
      currency: 'usd',
      sessionId: 'cs_experience_smoke',
      pending: true,
      createdAt: new Date(),
    },
  });
  const experienceId = String(experienceBooking._id);
  const experienceRoute = '/api/send/experience-confirm';
  const beforeExperience = JSON.stringify(
    await ExperienceBooking.findById(experienceId).lean()
  );
  const callsBeforeExperience = calls.length;
  await expectAuthenticationRedirect({
    origin: customer,
    route: experienceRoute,
    method: 'POST',
    body: { bookingId: experienceId },
  });
  for (const attempt of [
    {
      identity: 'foreign',
      status: 403,
      error: 'Not authorized to send this confirmation',
    },
    {
      identity: 'customer',
      status: 409,
      error: 'Payment is required before confirmation',
    },
  ]) {
    assert.deepEqual(
      await request({
        origin: customer,
        route: experienceRoute,
        method: 'POST',
        body: { bookingId: experienceId },
        identity: attempt.identity,
        status: attempt.status,
      }),
      { error: attempt.error }
    );
  }
  assert.equal(calls.length, callsBeforeExperience);
  assert.equal(
    JSON.stringify(await ExperienceBooking.findById(experienceId).lean()),
    beforeExperience
  );
  const experienceEvent = {
    id: 'evt_experience_paid',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_experience_smoke',
        payment_status: 'paid',
        amount_total: 7500,
        currency: 'usd',
        payment_intent: 'pi_experience_smoke',
        metadata: {
          reservationKind: 'experience',
          reservationId: experienceId,
          quoteToken: 'experience-quote',
        },
      },
    },
  };
  const reservationWebhook = async ({ payload, status }) =>
    expectJson({
      url: `${customer}/api/payments/webhook`,
      method: 'POST',
      body: payload,
      status,
      headers: {
        'stripe-signature': signingStripe.webhooks.generateTestHeaderString({
          payload: JSON.stringify(payload),
          secret: webhookSecret,
        }),
      },
    });
  emailFailure = true;
  assert.deepEqual(
    await reservationWebhook({ payload: experienceEvent, status: 500 }),
    { error: 'Webhook processing failed' }
  );
  let experiencePaid = await ExperienceBooking.findById(experienceId).lean();
  assert.equal(experiencePaid.isPaid, true);
  assert.equal(experiencePaid.receipts.length, 1);
  assert.equal(experiencePaid.receipts[0].amountCents, 7500);
  assert.equal(experiencePaid.checkout.pending, false);
  assert.equal(experiencePaid.paymentConfirmationSentAt, undefined);
  assert.equal(
    await ProcessedStripeEvent.exists({ eventId: experienceEvent.id }),
    null
  );
  const experienceReceipts = JSON.stringify(experiencePaid.receipts);
  const failedExperienceSend = calls.at(-1);
  emailFailure = false;
  assert.deepEqual(
    await reservationWebhook({ payload: experienceEvent, status: 200 }),
    { received: true }
  );
  const successfulExperienceSend = calls.at(-1);
  assert.deepEqual(
    successfulExperienceSend.options,
    failedExperienceSend.options
  );
  assert.equal(successfulExperienceSend.input.to, 'customer@example.invalid');
  assert.equal(
    successfulExperienceSend.input.from,
    'LodgeFlow <payments@lodgeflow.app>'
  );
  assert.equal(
    successfulExperienceSend.input.subject,
    'Experience Booking Confirmation - LodgeFlow'
  );
  const experienceText = successfulExperienceSend.input.html.replace(
    /<[^>]+>/g,
    ''
  );
  for (const expected of [
    'Smoke Kayak',
    'Monday, June 3, 2030',
    '15:00',
    '2 hours',
    'North dock',
    '$37.50',
    '$75.00',
    'Guide',
    'Safety gear',
    'Water',
    'Sunscreen',
  ])
    assert.ok(
      experienceText.includes(expected),
      `Missing experience email content: ${expected}`
    );
  experiencePaid = await ExperienceBooking.findById(experienceId).lean();
  assert.equal(JSON.stringify(experiencePaid.receipts), experienceReceipts);
  assert.ok(experiencePaid.paymentConfirmationSentAt instanceof Date);
  const afterExperienceDelivery = JSON.stringify(experiencePaid);
  const callsAfterExperienceDelivery = calls.length;
  assert.deepEqual(
    await reservationWebhook({ payload: experienceEvent, status: 200 }),
    { received: true }
  );
  assert.equal(calls.length, callsAfterExperienceDelivery);
  assert.equal(
    JSON.stringify(await ExperienceBooking.findById(experienceId).lean()),
    afterExperienceDelivery
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: experienceRoute,
      identity: 'customer',
      method: 'POST',
      body: { bookingId: experienceId },
      status: 200,
    }),
    { id: 'email_smoke' }
  );
  assert.equal(
    JSON.stringify(await ExperienceBooking.findById(experienceId).lean()),
    afterExperienceDelivery
  );

  const freeExperience = await Experience.create({
    ...experienceFields,
    name: 'Free walk',
    price: 0,
  });
  const freeExperienceBooking = await ExperienceBooking.create({
    experience: freeExperience._id,
    customer: 'smoke_customer',
    date: new Date('2030-06-03'),
    numParticipants: 1,
    totalPrice: 0,
    isPaid: false,
  });
  // Sparse legacy catalog rows omit arrays that hydrated reads used to default.
  await Experience.collection.updateOne(
    { _id: freeExperience._id },
    { $unset: { includes: '', whatToBring: '', location: '' } }
  );
  const freeExperienceBefore = JSON.stringify(
    await ExperienceBooking.findById(freeExperienceBooking._id).lean()
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: experienceRoute,
      identity: 'customer',
      method: 'POST',
      body: { bookingId: String(freeExperienceBooking._id) },
      status: 200,
    }),
    { id: 'email_smoke' }
  );
  assert.equal(
    calls.at(-1).input.from,
    'LodgeFlow <notifications@lodgeflow.app>'
  );
  const freeExperienceText = calls.at(-1).input.html.replace(/<[^>]+>/g, '');
  assert.ok(freeExperienceText.includes('$0.00 x 1 participant:'));
  for (const omitted of [
    'Time:',
    'Location:',
    "What's Included",
    'What to Bring',
  ])
    assert.ok(!freeExperienceText.includes(omitted));
  assert.equal(
    JSON.stringify(
      await ExperienceBooking.findById(freeExperienceBooking._id).lean()
    ),
    freeExperienceBefore
  );

  const missingExperienceId = new mongoose.Types.ObjectId();
  const missingExperienceBooking = await ExperienceBooking.create({
    experience: missingExperienceId,
    customer: 'smoke_customer',
    date: new Date('2030-06-03'),
    numParticipants: 1,
    totalPrice: 37.5,
    checkout: {
      token: 'missing-experience-quote',
      amountCents: 3750,
      currency: 'usd',
      sessionId: 'cs_missing_experience',
      pending: true,
      createdAt: new Date(),
    },
  });
  const missingExperienceEvent = {
    id: 'evt_missing_experience',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_missing_experience',
        payment_status: 'paid',
        amount_total: 3750,
        currency: 'usd',
        payment_intent: 'pi_missing_experience',
        metadata: {
          reservationKind: 'experience',
          reservationId: String(missingExperienceBooking._id),
          quoteToken: 'missing-experience-quote',
        },
      },
    },
  };
  const callsBeforeMissingExperience = calls.length;
  for (let retry = 0; retry < 2; retry++) {
    assert.deepEqual(
      await reservationWebhook({
        payload: missingExperienceEvent,
        status: 500,
      }),
      { error: 'Webhook processing failed' }
    );
    const row = await ExperienceBooking.findById(
      missingExperienceBooking._id
    ).lean();
    assert.equal(row.receipts.length, 1);
    assert.equal(row.isPaid, true);
    assert.equal(row.paymentConfirmationSentAt, undefined);
    assert.equal(
      await ProcessedStripeEvent.exists({ eventId: missingExperienceEvent.id }),
      null
    );
  }
  const missingExperienceBefore = JSON.stringify(
    await ExperienceBooking.findById(missingExperienceBooking._id).lean()
  );
  assert.deepEqual(
    await request({
      origin: customer,
      route: experienceRoute,
      identity: 'customer',
      method: 'POST',
      body: { bookingId: String(missingExperienceBooking._id) },
      status: 404,
    }),
    { error: 'Experience not found' }
  );
  assert.equal(
    JSON.stringify(
      await ExperienceBooking.findById(missingExperienceBooking._id).lean()
    ),
    missingExperienceBefore
  );
  assert.equal(calls.length, callsBeforeMissingExperience);
  await Experience.create({ ...experienceFields, _id: missingExperienceId });
  assert.deepEqual(
    await reservationWebhook({ payload: missingExperienceEvent, status: 200 }),
    { received: true }
  );
  const recoveredExperience = await ExperienceBooking.findById(
    missingExperienceBooking._id
  ).lean();
  assert.equal(recoveredExperience.receipts.length, 1);
  assert.ok(recoveredExperience.paymentConfirmationSentAt instanceof Date);
  console.log(
    'PASS experience confirmation rendering, paid/free senders, ownership, durable settlement and missing-reference retry recovery'
  );

  const dining = await Dining.create({
    name: 'Smoke Dinner',
    description: 'Email boundary fixture',
    type: 'menu',
    mealType: 'dinner',
    price: 30,
    servingTime: { start: '17:00', end: '21:00' },
    maxPeople: 8,
    category: 'regular',
    image: 'https://example.invalid/dinner.jpg',
  });
  const diningReservation = await DiningReservation.create({
    dining: dining._id,
    customer: 'smoke_customer',
    date: new Date('2030-06-03'),
    time: '18:00',
    numGuests: 2,
    totalPrice: 60,
    checkout: {
      token: 'dining-email-quote',
      amountCents: 6000,
      currency: 'usd',
      sessionId: 'cs_dining_email',
      pending: true,
      createdAt: new Date(),
    },
  });
  await DiningReservation.collection.updateOne(
    { _id: diningReservation._id },
    { $unset: { tablePreference: '' } }
  );
  const diningEmailEvent = {
    id: 'evt_dining_email',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_dining_email',
        payment_status: 'paid',
        amount_total: 6000,
        currency: 'usd',
        payment_intent: 'pi_dining_email',
        metadata: {
          reservationKind: 'dining',
          reservationId: String(diningReservation._id),
          quoteToken: 'dining-email-quote',
        },
      },
    },
  };
  assert.deepEqual(
    await reservationWebhook({ payload: diningEmailEvent, status: 200 }),
    { received: true }
  );
  const diningEmailText = calls.at(-1).input.html.replace(/<[^>]+>/g, '');
  for (const expected of ['Smoke Dinner', '18:00', '$60.00', '17:00 - 21:00'])
    assert.ok(diningEmailText.includes(expected));
  assert.ok(!diningEmailText.includes('Table Preference:'));
  assert.equal(calls.at(-1).input.from, 'LodgeFlow <payments@lodgeflow.app>');
  const diningDelivered = await DiningReservation.findById(
    diningReservation._id
  ).lean();
  assert.equal(diningDelivered.receipts.length, 1);
  assert.ok(diningDelivered.paymentConfirmationSentAt instanceof Date);
  console.log(
    'PASS shared confirmation helper retains dining rendering and delivery accounting'
  );

  const beforeConfirmationBoundary = JSON.stringify({
    cabin: await Booking.findById(bookingId).lean(),
    experience: await ExperienceBooking.findById(experienceId).lean(),
  });
  const callsBeforeConfirmationBoundary = calls.length;
  for (const { route, id } of [
    { route: '/api/send/confirm', id: bookingId },
    { route: '/api/send/payment-confirm', id: bookingId },
    { route: experienceRoute, id: experienceId },
  ]) {
    for (const { body, error } of [
      { body: null, error: 'Invalid request body' },
      { body: [], error: 'Invalid request body' },
      { body: {}, error: 'Booking ID is required' },
      { body: { bookingId: { $ne: null } }, error: 'Invalid booking ID' },
      { body: { bookingId: 'not-an-id' }, error: 'Invalid booking ID' },
    ])
      assert.deepEqual(
        await request({
          origin: customer,
          route,
          identity: 'customer',
          method: 'POST',
          body,
          status: 400,
        }),
        { error }
      );

    const malformed = await fetch(`${customer}${route}`, {
      method: 'POST',
      headers: { ...identity('customer'), 'content-type': 'application/json' },
      body: '{',
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(malformed.status, 400);
    assert.match(
      malformed.headers.get('content-type') ?? '',
      /application\/json/
    );
    assert.deepEqual(await malformed.json(), { error: 'Invalid JSON body' });

    await mongoose.connection.db.admin().command({
      configureFailPoint: 'failCommand',
      mode: { times: 1 },
      data: { failCommands: ['find'], errorCode: 2 },
    });
    assert.deepEqual(
      await request({
        origin: customer,
        route,
        identity: 'customer',
        method: 'POST',
        body: { bookingId: id },
        status: 500,
      }),
      { error: 'Failed to send confirmation email' }
    );
    await mongoose.connection.db
      .admin()
      .command({ configureFailPoint: 'failCommand', mode: 'off' });
  }
  assert.equal(calls.length, callsBeforeConfirmationBoundary);
  emailFailure = true;
  assert.deepEqual(
    await request({
      origin: customer,
      route: experienceRoute,
      identity: 'customer',
      method: 'POST',
      body: { bookingId: experienceId },
      status: 500,
    }),
    { error: 'Failed to send confirmation email' }
  );
  emailFailure = false;
  assert.deepEqual(
    await request({
      origin: customer,
      route: experienceRoute,
      identity: 'customer',
      method: 'POST',
      body: { bookingId: experienceId },
      status: 200,
    }),
    { id: 'email_smoke' }
  );
  assert.equal(
    JSON.stringify({
      cabin: await Booking.findById(bookingId).lean(),
      experience: await ExperienceBooking.findById(experienceId).lean(),
    }),
    beforeConfirmationBoundary
  );
  console.log(
    'PASS manual confirmation body validation, safe database/provider errors and no booking writes'
  );

  for (const call of calls.filter(call => call.route === '/resend/send')) {
    assert.equal(typeof call.input.html, 'string');
    assert.ok(
      call.input.html.length > 100,
      'Email template must render content'
    );
  }
  completed = true;
  console.log(
    'HTTP smoke passed (real Clerk SDK verifies local signed sessions; application authorization and database are real; hosted login is not exercised).'
  );
} finally {
  if (!completed) {
    for (const [app, output] of logs)
      console.error(
        `${app} diagnostics:\n${output.replaceAll(secret, '[REDACTED]')}`
      );
  }
  await cleanup();
}
