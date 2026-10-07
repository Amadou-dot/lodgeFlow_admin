import assert from 'node:assert/strict';
import test from 'node:test';
import { Types } from 'mongoose';
import Settings from '../src/models/Settings';
import { serializeSettings } from '../src/settings-json';

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
    assert.deepEqual(
      json(serializeSettings(settings.toObject())),
      json(settings)
    );
  }
  const sparse = Settings.hydrate({ _id: new Types.ObjectId() });
  const output = json(serializeSettings(sparse.toObject()));
  assert.deepEqual(output, json(sparse));
  assert.equal(JSON.stringify(output).includes('createdAt'), false);
});

test('Settings JSON copies nested state without retaining mutable references', () => {
  const source = new Settings({
    businessHours: { daysOpen: ['Monday'] },
    contactInfo: { address: { city: 'Forest' } },
  }).toObject();
  const output = serializeSettings(source);
  output.businessHours.daysOpen.push('Tuesday');
  assert.deepEqual(source.businessHours.daysOpen, ['Monday']);
  assert.ok(output.contactInfo?.address);
  output.contactInfo.address.city = 'Changed';
  assert.equal(source.contactInfo.address?.city, 'Forest');
  output.notifications.emailEnabled = false;
  assert.equal(source.notifications.emailEnabled, true);
});
