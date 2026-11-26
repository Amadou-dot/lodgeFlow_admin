const utcDateOptions: Intl.DateTimeFormatOptions = {
  timeZone: 'UTC',
  year: 'numeric',
};

const stayDateFormats = {
  short: new Intl.DateTimeFormat('en-US', {
    ...utcDateOptions,
    month: 'short',
    day: 'numeric',
  }),
  'short-padded': new Intl.DateTimeFormat('en-US', {
    ...utcDateOptions,
    month: 'short',
    day: '2-digit',
  }),
  'long-weekday': new Intl.DateTimeFormat('en-US', {
    ...utcDateOptions,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }),
  'long-weekday-padded': new Intl.DateTimeFormat('en-US', {
    ...utcDateOptions,
    weekday: 'long',
    month: 'long',
    day: '2-digit',
  }),
};

/** Format the UTC calendar day of a planned cabin stay. */
export function formatBookingStayDate({
  date,
  style,
}: {
  date: string;
  style: keyof typeof stayDateFormats;
}): string {
  const stayDate = new Date(date);

  if (Number.isNaN(stayDate.getTime())) {
    // Preserve the detail/print fallback and the guest/email fallback.
    // The padded short range formatter continues to throw on invalid dates.
    if (style === 'long-weekday-padded') return 'Invalid date';
    if (style !== 'short-padded') return 'Invalid Date';
  }

  return stayDateFormats[style].format(stayDate);
}
