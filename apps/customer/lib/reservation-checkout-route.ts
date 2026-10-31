import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  connectDB,
  createReservationCheckout,
  ReservationRuleError,
} from '@lodgeflow/database';
import { getStripe } from './stripe';
import { logger } from '@lodgeflow/database/logger';
import { getCustomerOrigin } from './url';
export async function reservationCheckout(
  request: NextRequest,
  { kind, id }: { kind: 'dining' | 'experience'; id: string }
) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  try {
    await connectDB();
    const url = await createReservationCheckout({
      kind,
      id,
      customer: userId,
      stripe: getStripe(),
      getReturnUrl: () => {
        const base = getCustomerOrigin({
          requestOrigin: request.nextUrl.origin,
        });
        return `${base}/${kind === 'dining' ? 'dining' : 'experiences'}/confirmation/${id}`;
      },
    });
    return NextResponse.json({ success: true, data: { url } });
  } catch (error: unknown) {
    if (!(error instanceof ReservationRuleError)) {
      logger.error('Error creating reservation checkout', error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof ReservationRuleError
            ? error.message
            : 'Unable to start checkout',
      },
      { status: error instanceof ReservationRuleError ? error.status : 500 }
    );
  }
}
