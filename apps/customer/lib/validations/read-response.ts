import { z } from 'zod';

const success = z.object({
  success: z.literal(true),
  data: z.unknown(),
  error: z.never().optional(),
  message: z.string().optional(),
});

// Retain the transport value itself, including additions inside nested records.
export function decodeSuccess<T>(schema: z.ZodType<T, T>) {
  const data = z.custom<T>(value => schema.safeParse(value).success);
  const envelope = success.extend({ data });
  return (value: unknown) => {
    const result = envelope.safeParse(value);
    return result.success ? result.data.data : undefined;
  };
}

export async function readResponse<T>(
  response: Response,
  decode: (value: unknown) => T | undefined,
  fallback: string
): Promise<T> {
  if (!response.ok) throw new Error(fallback);
  const body: unknown = await response.json().catch(() => undefined);
  const data = decode(body);
  if (data === undefined) throw new Error(fallback);
  return data;
}

export function forDetailId<T extends { _id: string; id: string }>(
  schema: z.ZodType<T, T>,
  id: string
) {
  return decodeSuccess(
    schema.refine(
      row =>
        row._id.toLowerCase() === id.toLowerCase() &&
        row.id.toLowerCase() === row._id.toLowerCase()
    )
  );
}
