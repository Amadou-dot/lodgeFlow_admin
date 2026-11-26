import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import Settings from '../src/models/Settings';
import { serializeSettings } from '../src/settings-json';
import { settingsJsonSchema } from '../src/settings-json-schema';

function json(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

test('Settings JSON retains IDs, dates, defaults, virtuals and minimized or null nested fields', () => {
  for (const contactInfo of [
    {},
    null,
    { phone: '18005551234', address: { city: 'Forest' } },
  ]) {
    const settings = Settings.hydrate({
      _id: new Types.ObjectId(),
      contactInfo,
      createdAt: new Date('2030-01-01'),
      updatedAt: new Date('2030-02-01'),
      __v: 2,
    });
    const output = json(serializeSettings(settings.toObject()));
    assert.deepEqual(output, json(settings));
    assert.deepEqual(settingsJsonSchema.parse(output), output);
  }
  const sparse = Settings.hydrate({ _id: new Types.ObjectId() });
  const output = json(serializeSettings(sparse.toObject()));
  assert.deepEqual(output, json(sparse));
  assert.deepEqual(settingsJsonSchema.parse(output), output);
  assert.equal(JSON.stringify(output).includes('createdAt'), false);
});

test('Settings JSON copies nested state without retaining mutable references', () => {
  const source = new Settings({
    businessHours: { daysOpen: ['Monday'] },
    contactInfo: { address: { city: 'Forest' } },
  }).toObject();
  const output = serializeSettings(source);
  assert.ok(output.businessHours?.daysOpen);
  output.businessHours.daysOpen.push('Tuesday');
  assert.deepEqual(source.businessHours.daysOpen, ['Monday']);
  assert.ok(output.contactInfo?.address);
  output.contactInfo.address.city = 'Changed';
  assert.equal(source.contactInfo.address?.city, 'Forest');
  assert.ok(output.notifications);
  output.notifications.emailEnabled = false;
  assert.equal(source.notifications.emailEnabled, true);
});
