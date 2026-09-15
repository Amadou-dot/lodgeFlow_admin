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
  const result = await response.json();
  if (!response.ok || !result.data?.url)
    throw new Error(result.error || 'Unable to start checkout');
  window.location.assign(result.data.url);
}
