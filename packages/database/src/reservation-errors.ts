import { MoneyError } from './money';

export class ReservationRuleError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = 'ReservationRuleError';
    Object.setPrototypeOf(this, ReservationRuleError.prototype);
  }
}

/** Keep invalid money inside the existing reservation HTTP error contract. */
export function reservationMoney<T>(
  calculate: () => T,
  { message }: { message?: string } = {}
): T {
  try {
    return calculate();
  } catch (error: unknown) {
    if (error instanceof MoneyError)
      throw new ReservationRuleError(message ?? error.message);
    throw error;
  }
}
