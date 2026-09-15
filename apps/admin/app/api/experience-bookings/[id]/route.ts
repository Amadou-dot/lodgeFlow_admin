import {
  reservationDetails,
  changeReservationStatus,
} from '@/lib/reservation-status-route';
import type { IdParam } from '@/types';
export async function GET(_request: Request, { params }: IdParam) {
  return reservationDetails((await params).id, 'experience');
}
export async function PATCH(request: Request, { params }: IdParam) {
  return changeReservationStatus(request, (await params).id, 'experience');
}
