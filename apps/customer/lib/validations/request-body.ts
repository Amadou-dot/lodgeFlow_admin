type JsonBodyResult =
  | { success: true; data: unknown }
  | { success: false; error: 'Invalid JSON body' };

/** Keep body-stream failures distinct from malformed JSON supplied by a client. */
export async function readJsonRequestBody(
  request: Pick<Request, 'text'>
): Promise<JsonBodyResult> {
  const text = await request.text();
  try {
    const data: unknown = JSON.parse(text);
    return { success: true, data };
  } catch (error: unknown) {
    if (error instanceof SyntaxError)
      return { success: false, error: 'Invalid JSON body' };
    throw error;
  }
}
