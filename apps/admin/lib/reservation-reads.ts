import {
  Booking,
  Cabin,
  Dining,
  DiningReservation,
  Experience,
  ExperienceBooking,
} from '@lodgeflow/database';
import { Types, type PipelineStage } from 'mongoose';
import {
  LIFECYCLES,
  RESERVATION_TYPES,
  type ReservationType,
} from './reservation-options';

const DAY = 86_400_000;
export function calendarRange(params: URLSearchParams) {
  const now = new Date();
  const start = params.get('start')
    ? new Date(params.get('start')!)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  let end = params.get('end')
    ? new Date(params.get('end')!)
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    end <= start
  )
    throw new Error('Invalid date range');
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(0, 0, 0, 0);
  if (end <= start) throw new Error('End date must be after start date');
  if (end.getTime() - start.getTime() > 180 * DAY)
    end = new Date(start.getTime() + 180 * DAY);
  return { start, end };
}
function projection(type: ReservationType): PipelineStage.Project {
  const reference =
    type === 'cabin' ? '$cabin' : type === 'dining' ? '$dining' : '$experience';
  return {
    $project: {
      _id: 1,
      type: { $literal: type },
      date: type === 'cabin' ? '$checkInDate' : '$date',
      endDate: type === 'cabin' ? '$checkOutDate' : { $literal: null },
      time:
        type === 'dining'
          ? '$time'
          : type === 'experience'
            ? { $ifNull: ['$timeSlot', null] }
            : { $literal: null },
      partySize: type === 'experience' ? '$numParticipants' : '$numGuests',
      resourceId: reference,
      customer: 1,
      status: 1,
      totalPrice: 1,
      isPaid: 1,
      createdAt: 1,
      lifecycle: {
        $switch: {
          branches: [
            { case: { $eq: ['$status', 'unconfirmed'] }, then: 'pending' },
            { case: { $eq: ['$status', 'checked-in'] }, then: 'active' },
            { case: { $eq: ['$status', 'checked-out'] }, then: 'completed' },
            { case: { $eq: ['$status', 'no-show'] }, then: 'no_show' },
          ],
          default: '$status',
        },
      },
    },
  };
}
export function reservationPipeline(params: URLSearchParams) {
  const page = Number(params.get('page') ?? 1),
    limit = Number(params.get('limit') ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new Error('Invalid pagination');
  const filter: Record<string, unknown> = {};
  const resourceId = params.get('resourceId');
  if (resourceId) {
    if (!/^[a-f0-9]{24}$/i.test(resourceId)) throw new Error('Invalid listing');
    filter.resourceId = new Types.ObjectId(resourceId);
  }
  const type = params.get('type'),
    lifecycle = params.get('lifecycle');
  if (type) {
    if (!(RESERVATION_TYPES as readonly string[]).includes(type))
      throw new Error('Invalid reservation type');
    filter.type = type;
  }
  if (lifecycle) {
    if (!(LIFECYCLES as readonly string[]).includes(lifecycle))
      throw new Error('Invalid lifecycle');
    filter.lifecycle = lifecycle;
  }
  const dates: Record<string, Date> = {};
  for (const [name, operator] of [
    ['from', '$gte'],
    ['to', '$lt'],
  ]) {
    const value = params.get(name);
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
    dates[operator] = date;
  }
  if (dates.$gte && dates.$lt && dates.$gte >= dates.$lt)
    throw new Error('Invalid date range');
  if (Object.keys(dates).length) filter.date = dates;
  const rows: PipelineStage.FacetPipelineStage[] = [
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];
  for (const [name, collection] of [
    ['cabin', Cabin.collection.name],
    ['dining', Dining.collection.name],
    ['experience', Experience.collection.name],
  ]) {
    rows.push({
      $lookup: {
        from: collection,
        localField: 'resourceId',
        foreignField: '_id',
        as: name + 'Resource',
      },
    });
  }
  rows.push({
    $set: {
      resourceName: {
        $ifNull: [
          {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$type', 'cabin'] },
                  then: { $arrayElemAt: ['$cabinResource.name', 0] },
                },
                {
                  case: { $eq: ['$type', 'dining'] },
                  then: { $arrayElemAt: ['$diningResource.name', 0] },
                },
              ],
              default: { $arrayElemAt: ['$experienceResource.name', 0] },
            },
          },
          'Removed listing',
        ],
      },
    },
  });
  rows.push({
    $unset: ['cabinResource', 'diningResource', 'experienceResource'],
  });
  const pipeline: PipelineStage[] = [
    projection('cabin'),
    {
      $unionWith: {
        coll: DiningReservation.collection.name,
        pipeline: [projection('dining')],
      },
    },
    {
      $unionWith: {
        coll: ExperienceBooking.collection.name,
        pipeline: [projection('experience')],
      },
    },
    { $match: filter },
    { $sort: { date: 1, time: 1, type: 1, _id: 1 } },
    { $facet: { rows, total: [{ $count: 'count' }] } },
  ];
  return { pipeline, page, limit };
}
export async function cabinCalendar(start: Date, end: Date) {
  const [resources, reservations] = await Promise.all([
    Cabin.find({}).select('name status').sort({ name: 1 }).lean(),
    Booking.find({
      status: { $ne: 'cancelled' },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    })
      .select('cabin checkInDate checkOutDate status customer')
      .sort({ checkInDate: 1, _id: 1 })
      .lean(),
  ]);
  return { resources, reservations };
}
export async function capacityCalendar(
  kind: 'dining' | 'experience',
  start: Date,
  end: Date
) {
  const model = kind === 'dining' ? DiningReservation : ExperienceBooking;
  const field = kind === 'dining' ? 'dining' : 'experience';
  const pipeline: PipelineStage[] = [
    {
      $match: {
        date: { $gte: start, $lt: end },
        status:
          kind === 'dining'
            ? { $nin: ['cancelled', 'no-show'] }
            : { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: {
          resourceId: '$' + field,
          date: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$date',
              timezone: 'UTC',
            },
          },
          ...(kind === 'dining' ? { time: '$time' } : {}),
        },
        used: { $sum: kind === 'dining' ? '$numGuests' : '$numParticipants' },
      },
    },
    { $sort: { '_id.date': 1, '_id.time': 1 } },
  ];
  const resources =
    kind === 'dining'
      ? await Dining.find({})
          .select('name maxPeople isAvailable servingTime')
          .sort({ name: 1 })
          .lean()
      : await Experience.find({})
          .select('name maxParticipants')
          .sort({ name: 1 })
          .lean();
  const usage = await model.aggregate(pipeline);
  return { resources, usage };
}
