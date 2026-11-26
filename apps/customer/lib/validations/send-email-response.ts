import { z } from 'zod';

// The routes return the provider's data object directly.
const sentEmailSchema = z.looseObject({ id: z.string() });
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
    const result = sentEmailSchema.safeParse(body);
    if (result.success) return result.data;
  } else {
    const result = sendEmailErrorSchema.safeParse(body);
    if (result.success) throw new Error(result.data.error);
  }

  throw new Error(fallback);
}
