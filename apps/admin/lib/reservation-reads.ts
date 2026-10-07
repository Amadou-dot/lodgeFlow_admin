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
  parseCalendarRange,
  parseReservationQuery,
} from './validations/reservation-reads';
import {
  serializeCalendarResource,
  serializeCalendarStay,
  serializeCalendarUsage,
  type CalendarResourceSource,
  type CalendarStaySource,
  type CalendarUsageSource,
} from './serializers/reservation-calendar';
import type { ReservationType } from './reservation-options';
export const calendarRange = parseCalendarRange;
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
  const { page, limit, resourceId, type, lifecycle, from, to } =
    parseReservationQuery(params);
  const filter = {
    ...(resourceId && { resourceId: new Types.ObjectId(resourceId) }),
    ...(type && { type }),
    ...(lifecycle && { lifecycle }),
    ...((from || to) && {
      date: { ...(from && { $gte: from }), ...(to && { $lt: to }) },
    }),
  };
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
export async function cabinCalendar({
  start,
  end,
}: {
  start: Date;
  end: Date;
}) {
  const [resources, reservations] = await Promise.all([
    Cabin.find({})
      .select('name status')
      .sort({ name: 1 })
      .lean<CalendarResourceSource[]>(),
    Booking.find({
      status: { $ne: 'cancelled' },
      checkInDate: { $lt: end },
      checkOutDate: { $gt: start },
    })
      .select('cabin checkInDate checkOutDate status customer')
      .sort({ checkInDate: 1, _id: 1 })
      .lean<CalendarStaySource[]>(),
  ]);
  return {
    resources: resources.map(serializeCalendarResource),
    reservations: reservations.map(serializeCalendarStay),
  };
}
export async function capacityCalendar({
  kind,
  start,
  end,
}: {
  kind: 'dining' | 'experience';
  start: Date;
  end: Date;
}) {
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
          .lean<CalendarResourceSource[]>()
      : await Experience.find({})
          .select('name maxParticipants')
          .sort({ name: 1 })
          .lean<CalendarResourceSource[]>();
  const usage = await model.aggregate<CalendarUsageSource>(pipeline);
  return {
    resources: resources.map(serializeCalendarResource),
    usage: usage.map(serializeCalendarUsage),
  };
}
