import { z } from 'zod';

export const welcomeEmailSchema = z.object({
  // Legacy omitted/null names render an empty greeting; normalize at the boundary.
  firstName: z.preprocess(value => (value == null ? '' : value), z.string()),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
});

export type WelcomeEmailInput = z.output<typeof welcomeEmailSchema>;

type WelcomeEmailRequest =
  | { success: true; data: WelcomeEmailInput }
  | { success: false; error: string };

export async function readWelcomeEmailRequest(
  request: Request
): Promise<WelcomeEmailRequest> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: 'Invalid welcome email data' };
  }

  const parsed = welcomeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      // Preserve invalid-email precedence when both fields are unusable.
      error: parsed.error.issues.some(issue => issue.path[0] === 'email')
        ? 'Invalid email address'
        : 'Invalid welcome email data',
    };
  }
  return { success: true, data: parsed.data };
}
