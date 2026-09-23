/** Fields rendered by the cabin confirmation email, with ISO dates and major units. */
export interface BookingEmailBooking {
  _id: string;
  checkInDate: string;
  checkOutDate: string;
  numNights: number;
  numGuests: number;
  cabinSubtotal: number;
  extrasPrice: number;
  totalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  extras: {
    hasBreakfast: boolean;
    breakfastPrice: number;
    hasPets: boolean;
    petFee: number;
    hasParking: boolean;
    parkingFee: number;
    hasEarlyCheckIn: boolean;
    earlyCheckInFee: number;
    hasLateCheckOut: boolean;
    lateCheckOutFee: number;
  };
}

export interface BookingEmailCabin {
  name: string;
  capacity: number;
  price: number;
  description: string;
  amenities: string[];
}
