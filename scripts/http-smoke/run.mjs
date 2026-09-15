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
    ...['customer', 'foreign', 'admin', 'front_desk', 'unassigned'].map(
      name => ({
        id: `smoke_${name}`,
        email: `${name}@example.invalid`,
        member: !['customer', 'foreign'].includes(name),
      })
    ),
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
    `${config}\n// Disposable harness configuration; source application config is untouched.\nconst originalWebpack = module.exports.webpack;\nmodule.exports.webpack = (config, options) => {\n config = originalWebpack ? originalWebpack(config, options) : config;\n config.resolve.alias = { ...config.resolve.alias, 'stripe$': path.join(__dirname, 'smoke-stripe.mjs'), '__smoke_actual_stripe__$': require.resolve('stripe'), 'resend$': path.join(__dirname, 'smoke-resend.mjs') };\n return config;\n};\n`
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
    image: 'https://example.invalid/cabin.jpg',
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
  console.log('PASS public customer catalog through proxy and route');
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
  assert.equal(creations[1].input.line_items[0].price_data.unit_amount, 7500);
  assert.match(
    creations[1].input.success_url,
    /^https:\/\/lodgeflow\.app\/payments\/success\?/
  );
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
  assert.equal(failedEmail.error.message, 'Injected email failure');
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
  console.log(
    'PASS existing confirmation email denial, provider failure, retry and no booking mutations'
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
  assert.equal(calls.at(-1).route, '/resend/send');
  console.log(
    'PASS real Stripe signature verification, duplicate settlement, email failure preserves durable receipt without delivery flag'
  );
  const receiptSnapshot = JSON.stringify(
    await Booking.findById(bookingId).lean()
  );
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
    assert.equal(failed.error.message, 'Injected email failure');
    emailFailure = false;
    const sent = await request({
      origin: customer,
      route,
      identity: 'customer',
      method: 'POST',
      body: { bookingId },
      status: 200,
    });
    assert.deepEqual(sent, { id: 'email_smoke' });
    assert.equal(calls.at(-1).input.to, 'customer@example.invalid');
  }
  assert.equal(
    JSON.stringify(await Booking.findById(bookingId).lean()),
    receiptSnapshot
  );
  console.log(
    'PASS existing customer welcome/payment email failures and retries preserve receipts'
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
    emailFailure = true;
    const failed = await request({
      origin: admin,
      route,
      identity: 'admin',
      method: 'POST',
      body,
      status: 500,
    });
    assert.equal(failed.error.message, 'Injected email failure');
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
  }
  console.log(
    'PASS existing admin email authorization, failure and success contracts'
  );

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
