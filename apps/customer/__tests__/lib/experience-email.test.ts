/** @jest-environment node */
import { Types, model } from 'mongoose';
import ExperienceBooking from '@lodgeflow/database/models/ExperienceBooking';
import { Experience } from '@lodgeflow/database/models/Experience';
import type { IExperience, IExperienceBooking } from '@lodgeflow/database';
import {
  serializeExperienceEmailBooking,
  serializeExperienceEmailExperience,
  ExperienceEmailReferenceError,
} from '@/lib/serializers/experience-email';

const bookingModel = model<IExperienceBooking>(ExperienceBooking.modelName);
const experienceModel = model<Omit<IExperience, '_id'>>(Experience.modelName);

test('serializes real booking documents to allowlisted string IDs and ISO dates', () => {
  const row = new bookingModel({
    _id: new Types.ObjectId('507f1f77bcf86cd7994390ab'),
    date: new Date('2030-06-03T15:00:00Z'),
    numParticipants: 2,
    totalPrice: 75.25,
    timeSlot: '15:00',
    observations: 'Private notes',
    customer: 'customer',
    checkout: {
      token: 'private-quote',
      amountCents: 7525,
      currency: 'usd',
      pending: true,
    },
  });
  const input = serializeExperienceEmailBooking(row);
  expect(input).toEqual({
    bookingId: '507f1f77bcf86cd7994390ab',
    date: '2030-06-03T15:00:00.000Z',
    numParticipants: 2,
    totalPrice: 75.25,
    timeSlot: '15:00',
  });
  expect(JSON.parse(JSON.stringify(input))).toEqual(input);
});

test('copies rendered catalog fields and detaches both arrays from the Mongoose document', () => {
  const row = new experienceModel({
    name: 'Kayak',
    price: 37.5,
    duration: '2 hours',
    location: 'Dock',
    includes: ['Guide'],
    whatToBring: ['Water'],
    description: 'Unrendered description',
    reservationVersion: 4,
  });
  const input = serializeExperienceEmailExperience(row);
  expect(input).toEqual({
    name: 'Kayak',
    price: 37.5,
    duration: '2 hours',
    location: 'Dock',
    includes: ['Guide'],
    whatToBring: ['Water'],
  });
  row.includes.push('Equipment');
  row.whatToBring?.push('Hat');
  expect(input.includes).toEqual(['Guide']);
  expect(input.whatToBring).toEqual(['Water']);
  input.includes.push('Detached');
  expect(row.includes).toEqual(['Guide', 'Equipment']);
});

test('normalizes omitted array defaults while preserving absent optional display fields', () => {
  const experience = new experienceModel({
    name: 'Walk',
    price: 0,
    duration: '1 hour',
  });
  expect(serializeExperienceEmailExperience(experience)).toEqual({
    name: 'Walk',
    price: 0,
    duration: '1 hour',
    location: undefined,
    includes: [],
    whatToBring: [],
  });
  const booking = new bookingModel({
    date: new Date('2030-06-03'),
    numParticipants: 1,
    totalPrice: 0,
  });
  expect(serializeExperienceEmailBooking(booking).timeSlot).toBeUndefined();
});

test('missing experience raises a typed error so settlement delivery can retry', () => {
  expect(() => serializeExperienceEmailExperience(null)).toThrow(
    ExperienceEmailReferenceError
  );
  expect(new ExperienceEmailReferenceError()).toBeInstanceOf(Error);
});

test('rejects a malformed stored identifier at the serializer boundary', () => {
  const row = bookingModel.hydrate({
    _id: null,
    date: new Date('2030-06-03'),
    numParticipants: 1,
    totalPrice: 0,
  });
  expect(() => serializeExperienceEmailBooking(row)).toThrow(TypeError);
});
