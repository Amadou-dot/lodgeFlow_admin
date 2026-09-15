import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { expectJson } from './assert-http.mjs';

test('HTTP gate rejects status, redirect, non-JSON, malformed JSON, and timeout failures', async () => {
  const server = createServer((request, response) => {
    if (request.url === '/timeout') return;
    if (request.url === '/slow-body') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{');
      return;
    }
    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/ok' });
      response.end();
      return;
    }
    if (request.url === '/html') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<h1>error</h1>');
      return;
    }
    response.writeHead(request.url === '/failure' ? 500 : 200, {
      'content-type': 'application/json',
    });
    response.end(
      request.url === '/malformed'
        ? '{'
        : request.url === '/bad-body'
          ? '{"success":false}'
          : '{"success":true}'
    );
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await expectJson({ url: `${base}/ok`, status: 200 }), {
      success: true,
    });
    for (const path of [
      'failure',
      'redirect',
      'html',
      'malformed',
      'timeout',
      'slow-body',
    ]) {
      await assert.rejects(
        expectJson({ url: `${base}/${path}`, status: 200, timeoutMs: 100 })
      );
    }
    // Prove these failures propagate to a nonzero process exit, as required by CI.
    for (const route of ['failure', 'timeout', 'bad-body']) {
      const script = `import assert from 'node:assert/strict'; import { expectJson } from ${JSON.stringify(new URL('./assert-http.mjs', import.meta.url).href)}; const body = await expectJson({url:${JSON.stringify(`${base}/${route}`)},status:200,timeoutMs:100}); assert.deepEqual(body,{success:true});`;
      const exitCode = await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ['--input-type=module', '-e', script],
          { stdio: 'ignore' }
        );
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('Failure probe hung'));
        }, 3000);
        child.once('error', error => {
          clearTimeout(timer);
          reject(error);
        });
        child.once('exit', code => {
          clearTimeout(timer);
          resolve(code);
        });
      });
      assert.equal(exitCode, 1, `${route} must fail the CI process`);
    }
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
