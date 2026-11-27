import { readCheckoutResponse } from '@/lib/validations/checkout-response';

export async function openReservationCheckout({
  kind,
  id,
}: {
  kind: 'dining' | 'experience';
  id: string;
}) {
  const response = await fetch(
    `/api/${kind === 'dining' ? 'dining-reservations' : 'experience-bookings'}/${id}/checkout`,
    { method: 'POST' }
  );
  const { url } = await readCheckoutResponse({
    response,
    fallbackMessage: 'Unable to start checkout',
  });
  window.location.assign(url);
}
