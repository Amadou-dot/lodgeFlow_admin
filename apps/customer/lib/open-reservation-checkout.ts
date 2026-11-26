import { readCheckoutResponse } from '@/lib/validations/checkout-response';

export async function openReservationCheckout({
  kind,
  id,
  isCurrent,
}: {
  kind: 'dining' | 'experience';
  id: string;
  isCurrent?: () => boolean;
}) {
  const response = await fetch(
    `/api/${kind === 'dining' ? 'dining-reservations' : 'experience-bookings'}/${id}/checkout`,
    { method: 'POST' }
  );
  const { url } = await readCheckoutResponse({
    response,
    fallbackMessage: 'Unable to start checkout',
  });
  if (!isCurrent || isCurrent()) window.location.assign(url);
}
