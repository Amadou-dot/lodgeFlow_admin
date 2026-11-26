export function requireWebhookString(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Invalid signed webhook field');
  return value;
}

export function assertWebhookObject(
  value: unknown
): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid signed webhook object');
}

export function webhookMetadata(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  assertWebhookObject(value);
  return value;
}

export function optionalWebhookId(value: unknown): string | undefined {
  if (value == null || value === '') return undefined;
  return requireWebhookString(value);
}

export function reservationTarget(metadata: Record<string, unknown>) {
  const kind = metadata.reservationKind;
  if (kind !== 'dining' && kind !== 'experience') return;
  const id = optionalWebhookId(metadata.reservationId);
  if (id) return { kind, id } as const;
}

export function webhookPaymentIntent(value: unknown): string | undefined {
  if (value == null) return;
  if (typeof value === 'string') return optionalWebhookId(value);
  assertWebhookObject(value);
  return requireWebhookString(value.id);
}
