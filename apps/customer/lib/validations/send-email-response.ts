import { z } from 'zod';

// The routes return the provider's data object directly.
function isSentEmail(
  body: unknown
): body is { id: string; [field: string]: unknown } {
  return (
    typeof body === 'object' &&
    body !== null &&
    !Array.isArray(body) &&
    'id' in body &&
    Object.hasOwn(body, 'id') &&
    typeof body.id === 'string'
  );
}
const sendEmailErrorSchema = z.object({
  error: z.string().refine(message => message.trim().length > 0),
});

export async function readSendEmailResponse({
  response,
  kind,
}: {
  response: Response;
  kind: 'confirmation' | 'welcome';
}) {
  const fallback =
    kind === 'welcome'
      ? 'Failed to send welcome email'
      : 'Failed to send confirmation email';

  if (!response.ok && kind === 'welcome') throw new Error(fallback);

  const body: unknown = await response.json().catch(() => undefined);
  if (response.ok) {
    if (isSentEmail(body)) return body;
  } else {
    const result = sendEmailErrorSchema.safeParse(body);
    if (result.success) throw new Error(result.data.error);
  }

  throw new Error(fallback);
}
