export const RESERVATION_TYPES = ['cabin', 'dining', 'experience'] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];
export const LIFECYCLES = [
  'pending',
  'confirmed',
  'active',
  'completed',
  'cancelled',
  'no_show',
] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];
export function reservationLifecycle(status: string): string {
  return (
    (
      {
        unconfirmed: 'pending',
        'checked-in': 'active',
        'checked-out': 'completed',
        'no-show': 'no_show',
      } as Record<string, string>
    )[status] ?? status
  );
}
export function reservationHref(type: ReservationType, id: string) {
  return type === 'cabin' ? `/bookings/${id}` : `/reservations/${type}/${id}`;
}
export function utcDate(value: string) {
  return value.slice(0, 10);
}
export interface ReservationRow {
  _id: string;
  type: ReservationType;
  date: string;
  endDate: string | null;
  time: string | null;
  partySize: number;
  resourceName: string;
  customer: string;
  customerName: string;
  status: string;
  lifecycle: Lifecycle;
  totalPrice: number;
  isPaid: boolean;
}
