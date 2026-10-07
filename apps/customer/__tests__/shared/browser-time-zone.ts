/** Emulate a browser's default zone while honoring an explicit display zone. */
export function mockBrowserTimeZone(timeZone: string) {
  return jest
    .spyOn(Date.prototype, 'toLocaleDateString')
    .mockImplementation(function (this: Date, locales, options) {
      return new Intl.DateTimeFormat(locales, { timeZone, ...options }).format(
        this
      );
    });
}
