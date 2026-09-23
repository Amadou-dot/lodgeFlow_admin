/** Plain email input: ISO timestamps and major currency units. */
export interface PaymentEmailBooking {
  _id: string;
  customer: string;
  checkInDate: string;
  checkOutDate: string;
  totalPrice: number;
  remainingAmount: number;
}

export interface PaymentEmailCabin {
  name: string;
}
