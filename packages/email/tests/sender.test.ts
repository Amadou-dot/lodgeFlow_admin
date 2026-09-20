import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { EmailSenderConfigurationError, getEmailSender } from '../src/index';

const originalPayment = process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
const originalNotification = process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
afterEach(() => {
  for (const [key, value] of [
    ['LODGEFLOW_PAYMENT_EMAIL_FROM', originalPayment],
    ['LODGEFLOW_NOTIFICATION_EMAIL_FROM', originalNotification],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('approved defaults distinguish payment and notification senders', () => {
  delete process.env.LODGEFLOW_PAYMENT_EMAIL_FROM;
  delete process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM;
  assert.equal(
    getEmailSender({ kind: 'payment' }),
    'LodgeFlow <payments@lodgeflow.app>'
  );
  assert.equal(
    getEmailSender({ kind: 'notification' }),
    'LodgeFlow <notifications@lodgeflow.app>'
  );
});

test('overrides are independent and read lazily', () => {
  process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = 'receipts+test@example.com';
  process.env.LODGEFLOW_NOTIFICATION_EMAIL_FROM = 'updates@example.org';
  assert.equal(
    getEmailSender({ kind: 'payment' }),
    'LodgeFlow <receipts+test@example.com>'
  );
  assert.equal(
    getEmailSender({ kind: 'notification' }),
    'LodgeFlow <updates@example.org>'
  );
  process.env.LODGEFLOW_PAYMENT_EMAIL_FROM = 'billing@example.com';
  assert.equal(
    getEmailSender({ kind: 'payment' }),
    'LodgeFlow <billing@example.com>'
  );
});

test('invalid overrides fail closed with a typed, redacted error', () => {
  for (const mailbox of [
    '',
    ' mail@example.com',
    'mail@example.com\n',
    'mail@example.com\r\nBcc: x@example.com',
    'Name <mail@example.com>',
    'a@example.com,b@example.com',
    'a..b@example.com',
    'a@-example.com',
    'a@example',
    'a@exam_ple.com',
    `${'a'.repeat(65)}@example.com`,
  ] as const) {
    for (const kind of ['payment', 'notification'] as const) {
      const variable =
        kind === 'payment'
          ? 'LODGEFLOW_PAYMENT_EMAIL_FROM'
          : 'LODGEFLOW_NOTIFICATION_EMAIL_FROM';
      process.env[variable] = mailbox;
      assert.throws(
        () => getEmailSender({ kind }),
        error => {
          assert.ok(error instanceof EmailSenderConfigurationError);
          assert.equal(
            error.message,
            `${variable} must contain a valid mailbox address`
          );
          return true;
        }
      );
    }
  }
});
