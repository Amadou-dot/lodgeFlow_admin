import { z } from 'zod';

export interface MutationTarget {
  customerId: string | null | undefined;
  id?: string;
}

export function ownedDetail<
  T extends { customer: string; id: string; _id: string },
>(schema: z.ZodType<T, T>, { customerId, id }: MutationTarget) {
  return schema.refine(
    row =>
      row.customer === customerId &&
      row._id.toLowerCase() === row.id.toLowerCase() &&
      (id === undefined || row._id.toLowerCase() === id.toLowerCase())
  );
}

const errorBody = z.object({
  data: z.never().optional(),
  success: z.literal(false).optional(),
  error: z.string().refine(text => text.trim().length > 0),
});

export class CreateRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CreateRejectedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export async function readMutationResponse<T>({
  request,
  status,
  schema,
  fallback,
}: {
  request: Promise<Response>;
  status: 200 | 201;
  schema: z.ZodType<T, T>;
  fallback: string;
}) {
  let response: Response;
  try {
    response = await request;
  } catch {
    throw new Error(fallback);
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const failure = errorBody.safeParse(body);
    const message = failure.success ? failure.data.error : fallback;
    // These create handlers reject before insert on these four statuses. A
    // later populate, serialization or transport failure can follow a commit.
    if (
      status === 201 &&
      failure.success &&
      failure.data.success === false &&
      [400, 401, 404, 409].includes(response.status)
    ) {
      throw new CreateRejectedError(message);
    }
    throw new Error(message);
  }
  const envelope = z.looseObject({
    success: z.literal(true),
    data: z.custom<T>(value => schema.safeParse(value).success),
    message: z.string().optional(),
    error: z.never().optional(),
  });
  const result = envelope.safeParse(body);
  if (response.status !== status || !result.success) throw new Error(fallback);
  return result.data;
}
