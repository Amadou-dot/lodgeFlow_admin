import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createClerkFixture } from './clerk-fixture.mjs';

// Production rendering matters here: next dev does not expose stale prerenders.
// Never load app env files or connect to an inherited database/provider target.
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const databaseRequire = createRequire(
  path.join(root, 'packages/database/package.json')
);
const customerRequire = createRequire(
  path.join(root, 'apps/customer/package.json')
);
const { MongoMemoryServer } = databaseRequire('mongodb-memory-server');
const mongoose = databaseRequire('mongoose');
const { default: Cabin } =
  await import('../../packages/database/src/models/Cabin.ts');
const workspace = await mkdtemp(
  path.join(tmpdir(), 'lodgeflow-catalog-production-')
);
const app = path.join(workspace, 'apps/customer');
const next = customerRequire.resolve('next/dist/bin/next');
const clerk = createClerkFixture({ organizationId: 'catalog_test', users: [] });
let database;
let server;
let output = '';

function start(args, env) {
  const child = spawn(process.execPath, [next, ...args], {
    cwd: app,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => {
      output = (output + chunk.toString()).slice(-40000);
    });
  }
  return child;
}
async function freePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve, reject) =>
    socket.close(error => (error ? reject(error) : resolve()))
  );
  return port;
}

try {
  await cp(path.join(root, 'apps/customer'), app, {
    recursive: true,
    filter: source =>
      !path
        .relative(path.join(root, 'apps/customer'), source)
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
            part.endsWith('.tsbuildinfo')
        ),
  });
  await mkdir(path.join(workspace, 'packages'), { recursive: true });
  for (const name of ['database', 'email']) {
    await symlink(
      path.join(root, 'packages', name),
      path.join(workspace, 'packages', name),
      'dir'
    );
  }
  await symlink(
    path.join(root, 'node_modules'),
    path.join(workspace, 'node_modules'),
    'dir'
  );
  await symlink(
    path.join(root, 'apps/customer/node_modules'),
    path.join(app, 'node_modules'),
    'dir'
  );
  for (const filename of ['package.json', 'pnpm-workspace.yaml']) {
    await cp(path.join(root, filename), path.join(workspace, filename));
  }
  database = await MongoMemoryServer.create();
  const mongoUri = database.getUri('catalog_freshness');
  await mongoose.connect(mongoUri);
  const fixture = name => ({
    name,
    capacity: 2,
    price: 100,
    discount: 0,
    description: 'Disposable cabin',
    image: 'https://images.unsplash.com/test.jpg',
    status: 'active',
  });
  const original = await Cabin.create(fixture('Original Catalog Cabin'));
  const env = {
    ...Object.fromEntries(
      ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'SystemRoot']
        .filter(key => process.env[key])
        .map(key => [key, process.env[key]])
    ),
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    MONGODB_URI: mongoUri,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: clerk.publishableKey,
    CLERK_SECRET_KEY: clerk.secretKey,
  };
  console.log(
    'Building isolated production customer app with disposable cabin data'
  );
  const build = start(['build', '--webpack'], env);
  const [buildCode] = await once(build, 'exit');
  assert.equal(buildCode, 0, 'production build must pass');
  const port = await freePort();
  server = start(
    ['start', '--hostname', 'localhost', '--port', String(port)],
    env
  );
  const origin = `http://localhost:${port}`;
  for (let attempt = 0; ; attempt++) {
    assert.equal(
      server.exitCode,
      null,
      'production server must remain running'
    );
    try {
      await fetch(`${origin}/api/cabins`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(1000),
      });
      break;
    } catch (error) {
      if (attempt >= 100)
        throw new Error('production server readiness timed out', {
          cause: error,
        });
      await delay(100);
    }
  }
  const html = async route => {
    const response = await fetch(`${origin}${route}`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    assert.equal(response.status, 200, `${route} must load`);
    return response.text();
  };
  for (const route of ['/', '/cabins']) {
    assert.ok(
      (await html(route)).includes(`/cabins/${original.id}`),
      `${route} must initially link the original cabin`
    );
  }
  await Cabin.deleteOne({ _id: original._id });
  const replacement = await Cabin.create(fixture('Replacement Catalog Cabin'));
  for (const route of ['/', '/cabins']) {
    const page = await html(route);
    assert.ok(
      page.includes(`/cabins/${replacement.id}`),
      `${route} must link the replacement cabin after catalog changes`
    );
    assert.equal(
      page.includes(`/cabins/${original.id}`),
      false,
      `${route} must remove the deleted cabin link`
    );
  }
  assert.ok(
    (await html(`/cabins/${replacement.id}`)).includes(
      'Replacement Catalog Cabin'
    )
  );
  const removed = await fetch(`${origin}/cabins/${original.id}`, {
    redirect: 'manual',
  });
  assert.equal(removed.status, 404);
  console.log(
    'PASS production homepage/catalog refresh after cabin replacement; current detail 200, removed detail 404'
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await once(server, 'exit');
  }
  await mongoose.disconnect();
  await database?.stop();
  await rm(workspace, { recursive: true, force: true });
}
