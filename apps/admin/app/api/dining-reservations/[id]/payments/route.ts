import { reservationPayment } from '@/lib/reservation-payment-route';
import type { IdParam } from '@/types';
export async function POST(request: Request, { params }: IdParam) {
  return reservationPayment(request, { id: (await params).id, kind: 'dining' });
}
