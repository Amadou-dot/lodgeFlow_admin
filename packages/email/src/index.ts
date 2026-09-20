export type EmailKind = 'payment' | 'notification';

const senders = {
  payment: {
    variable: 'LODGEFLOW_PAYMENT_EMAIL_FROM',
    fallback: 'payments@lodgeflow.app',
  },
  notification: {
    variable: 'LODGEFLOW_NOTIFICATION_EMAIL_FROM',
    fallback: 'notifications@lodgeflow.app',
  },
} satisfies Record<EmailKind, { variable: string; fallback: string }>;

export class EmailSenderConfigurationError extends Error {
  constructor(variable: string) {
    super(`${variable} must contain a valid mailbox address`);
    this.name = 'EmailSenderConfigurationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// Deliberately accept a single ASCII mailbox, not a display name or header.
function isMailbox(value: string): boolean {
  if (value.length > 254 || /\s/.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  return (
    local.length > 0 &&
    local.length <= 64 &&
    /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/.test(
      local
    ) &&
    domain.includes('.') &&
    domain
      .split('.')
      .every(label =>
        /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label)
      )
  );
}

/** Server-only configuration, resolved when sending rather than during builds. */
export function getEmailSender({ kind }: { kind: EmailKind }): string {
  const { variable, fallback } = senders[kind];
  const mailbox = process.env[variable] ?? fallback;
  if (!isMailbox(mailbox)) throw new EmailSenderConfigurationError(variable);
  return `LodgeFlow <${mailbox}>`;
}
