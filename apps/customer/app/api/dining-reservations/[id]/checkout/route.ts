import { reservationCheckout } from '@/lib/reservation-checkout-route';
import type { NextRequest } from 'next/server';
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return reservationCheckout(request, {
    id: (await params).id,
    kind: 'dining',
  });
}
