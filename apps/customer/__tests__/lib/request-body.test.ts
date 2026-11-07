/** @jest-environment node */
import { readJsonRequestBody } from '@/lib/validations/request-body';

const limit = 1024 * 1024;
const oversized = { success: false, error: 'JSON body exceeds 1048576 bytes' };
const request = (body: string, headers: HeadersInit = {}) =>
  new Request('https://lodgeflow.test', { method: 'POST', body, headers });

test('accepts JSON exactly at the byte limit', async () => {
  const value = 'a'.repeat(limit - 2);
  expect(await readJsonRequestBody(request(JSON.stringify(value)))).toEqual({
    success: true,
    data: value,
  });
});

test.each<HeadersInit>([
  {},
  { 'content-length': '1' },
  { 'content-length': 'invalid' },
])('rejects oversized bodies regardless of header %p', async headers => {
  expect(
    await readJsonRequestBody(
      request(JSON.stringify('a'.repeat(limit - 1)), headers)
    )
  ).toEqual(oversized);
});

test('rejects an oversized declared length before consuming the body', async () => {
  let read = false;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      pull(controller) {
        read = true;
        controller.enqueue(new TextEncoder().encode('{}'));
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const input = new Request('https://lodgeflow.test', {
    method: 'POST',
    body,
    headers: { 'content-length': String(limit + 1) },
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  expect(await readJsonRequestBody(input)).toEqual(oversized);
  expect(read).toBe(false);
  expect(cancelled).toBe(true);
});

test('stops and cancels chunked input at overflow', async () => {
  let reads = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>(
    {
      pull(controller) {
        reads += 1;
        controller.enqueue(
          new TextEncoder().encode(reads === 1 ? ' '.repeat(limit) : 'x')
        );
        if (reads === 3) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const input = new Request('https://lodgeflow.test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  expect(await readJsonRequestBody(input)).toEqual(oversized);
  expect(reads).toBe(2);
  expect(cancelled).toBe(true);
  expect(body.locked).toBe(false);
});

test('counts UTF-8 bytes instead of string length', async () => {
  expect(
    await readJsonRequestBody(request(JSON.stringify('é'.repeat(limit / 2))))
  ).toEqual(oversized);
});

test('decodes multibyte characters split across chunks', async () => {
  const bytes = new TextEncoder().encode('{"note":"é🌲"}');
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      bytes.forEach(byte => controller.enqueue(new Uint8Array([byte])));
      controller.close();
    },
  });
  const input = new Request('https://lodgeflow.test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  expect(await readJsonRequestBody(input)).toEqual({
    success: true,
    data: { note: 'é🌲' },
  });
});

test.each(['{', '', '   '])(
  'preserves malformed JSON handling for %p',
  async body => {
    expect(await readJsonRequestBody(request(body))).toEqual({
      success: false,
      error: 'Invalid JSON body',
    });
  }
);

test('keeps body-stream failures distinct from malformed JSON', async () => {
  const error = new Error('stream unavailable');
  const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
    start(controller) {
      controller.error(error);
    },
  });
  const input = new Request('https://lodgeflow.test', {
    method: 'POST',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
  await expect(readJsonRequestBody(input)).rejects.toBe(error);
  expect(body.locked).toBe(false);
});

test.each(['pending', 'rejected'])(
  'does not wait for %s overflow cancellation',
  async mode => {
    const body = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new Uint8Array(limit + 1));
      },
      cancel() {
        return mode === 'pending'
          ? new Promise<void>(() => {})
          : Promise.reject(new Error('cancel failed'));
      },
    });
    expect(await readJsonRequestBody({ body, headers: new Headers() })).toEqual(
      oversized
    );
    expect(body.locked).toBe(false);
  }
);

test('preserves empty JSON cancellation bodies only when explicitly requested', async () => {
  expect(
    await readJsonRequestBody(request('   '), { emptyBody: 'empty-object' })
  ).toEqual({ success: true, data: {} });
});
