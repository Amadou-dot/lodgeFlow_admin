/** A validated failure response that distinguishes a rejection from a lost reply. */
export class StaffRequestRejected extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    Object.setPrototypeOf(this, StaffRequestRejected.prototype);
  }
}
