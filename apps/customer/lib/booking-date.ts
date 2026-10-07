/** Cabin stay dates use UTC calendar days; they are not local event timestamps. */
export function formatBookingStayDate({
  date,
  weekday,
}: {
  date: string;
  weekday?: 'long';
}): string {
  return new Date(date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
