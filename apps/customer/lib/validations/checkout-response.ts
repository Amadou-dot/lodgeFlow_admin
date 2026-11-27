import { z } from 'zod';

const urlSchema = z.url();
const checkoutSuccessSchema = z.object({
  success: z.literal(true),
  data: z.looseObject({
    // Validate the URL without normalizing the provider's original text.
    url: z
      .string()
      .refine(
        url =>
          /^https?:\/\/[^/\\?#\s]/i.test(url) &&
          urlSchema.safeParse(url).success
      ),
  }),
});
const checkoutErrorSchema = z.object({
  error: z.string().refine(message => message.trim().length > 0),
});

export async function readCheckoutResponse({
  response,
  fallbackMessage,
}: {
  response: Response;
  fallbackMessage: string;
}) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (response.ok) {
    const checkout = checkoutSuccessSchema.safeParse(payload);
    if (checkout.success) return checkout.data.data;
  }

  const failure = checkoutErrorSchema.safeParse(payload);
  throw new Error(failure.success ? failure.data.error : fallbackMessage);
}
