/** Plain experience confirmation inputs: ISO dates and major currency amounts. */
export interface ExperienceEmailBooking {
  bookingId: string;
  date: string;
  numParticipants: number;
  totalPrice: number;
  timeSlot?: string;
}

export interface ExperienceEmailExperience {
  name: string;
  price: number;
  duration: string;
  location?: string;
  includes: string[];
  whatToBring: string[];
}
