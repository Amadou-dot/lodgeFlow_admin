// JSON mutations contain text/URLs, not file uploads. Bound bytes before parsing.
export const MAX_JSON_BODY_BYTES = 1024 * 1024;
const BODY_TOO_LARGE = 'JSON body exceeds 1048576 bytes';

type JsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; error: 'Invalid JSON body' | typeof BODY_TOO_LARGE };

/** Keep transport failures distinct from malformed or oversized client input. */
export async function readJsonRequestBody(
  request: Pick<Request, 'body' | 'headers'>,
  options?: { emptyBody: 'empty-object' }
): Promise<JsonBodyResult> {
  const declaredLength = request.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_JSON_BODY_BYTES
  ) {
    // Do not wait for a remote producer to acknowledge cancellation.
    void request.body?.cancel().catch(() => undefined);
    return { success: false, error: BODY_TOO_LARGE };
  }

  let text = '';
  if (request.body) {
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_JSON_BODY_BYTES) {
          void reader.cancel().catch(() => undefined);
          return { success: false, error: BODY_TOO_LARGE };
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  }

  if (options?.emptyBody === 'empty-object' && !text.trim()) {
    return { success: true, data: {} };
  }
  try {
    const data: unknown = JSON.parse(text);
    return { success: true, data };
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return { success: false, error: 'Invalid JSON body' };
    throw error;
  }
}
