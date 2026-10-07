import type { Types } from 'mongoose';
import type {
  CalendarResource,
  CalendarStay,
  CalendarUsage,
  ReservationRow,
} from '@/types/reservation-calendar';
export type CalendarResourceSource = Omit<CalendarResource, '_id'> & {
  _id: Types.ObjectId;
};
export type CalendarStaySource = Omit<
  CalendarStay,
  '_id' | 'cabin' | 'checkInDate' | 'checkOutDate'
> & {
  _id: Types.ObjectId;
  cabin: Types.ObjectId;
  checkInDate: Date;
  checkOutDate: Date;
};
export type CalendarUsageSource = Omit<CalendarUsage, '_id'> & {
  _id: Omit<CalendarUsage['_id'], 'resourceId'> & {
    resourceId: Types.ObjectId;
  };
};
export type ReservationRowSource = Omit<
  ReservationRow,
  '_id' | 'resourceId' | 'date' | 'endDate' | 'createdAt' | 'customerName'
> & {
  _id: Types.ObjectId;
  resourceId: Types.ObjectId;
  date: Date;
  endDate: Date | null;
  createdAt: Date;
};
export interface ReservationInboxSource {
  rows: ReservationRowSource[];
  total: { count: number }[];
}
export function serializeCalendarResource(
  row: CalendarResourceSource
): CalendarResource {
  return {
    _id: row._id.toHexString(),
    name: row.name,
    ...(row.status !== undefined && { status: row.status }),
    ...(row.isAvailable !== undefined && { isAvailable: row.isAvailable }),
    ...(row.maxPeople !== undefined && { maxPeople: row.maxPeople }),
    ...(row.maxParticipants !== undefined && {
      maxParticipants: row.maxParticipants,
    }),
    ...(row.servingTime !== undefined && {
      servingTime:
        row.servingTime == null
          ? row.servingTime
          : { start: row.servingTime.start, end: row.servingTime.end },
    }),
  };
}
export function serializeCalendarStay(row: CalendarStaySource): CalendarStay {
  return {
    _id: row._id.toHexString(),
    cabin: row.cabin.toHexString(),
    customer: row.customer,
    checkInDate: row.checkInDate.toISOString(),
    checkOutDate: row.checkOutDate.toISOString(),
    status: row.status,
  };
}
export function serializeCalendarUsage(
  row: CalendarUsageSource
): CalendarUsage {
  return {
    _id: {
      resourceId: row._id.resourceId.toHexString(),
      date: row._id.date,
      time: row._id.time,
    },
    used: row.used,
  };
}
export function serializeReservationRow({
  row,
  customerName,
}: {
  row: ReservationRowSource;
  customerName: string;
}): ReservationRow {
  return {
    _id: row._id.toHexString(),
    type: row.type,
    date: row.date.toISOString(),
    endDate: row.endDate == null ? null : row.endDate.toISOString(),
    time: row.time,
    partySize: row.partySize,
    resourceId: row.resourceId.toHexString(),
    resourceName: row.resourceName,
    customer: row.customer,
    customerName,
    status: row.status,
    lifecycle: row.lifecycle,
    totalPrice: row.totalPrice,
    isPaid: row.isPaid,
    createdAt: row.createdAt.toISOString(),
  };
}
