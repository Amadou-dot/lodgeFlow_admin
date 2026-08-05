export interface BookingFormData {
  cabin: string;
  customer: string;
  checkInDate: string;
  checkOutDate: string;
  numGuests: number;
  hasBreakfast: boolean;
  hasPets: boolean;
  hasParking: boolean;
  hasEarlyCheckIn: boolean;
  hasLateCheckOut: boolean;
  observations: string;
  specialRequests: string[];
  paymentMethod: string;
  isPaid: boolean;
  depositPaid: boolean;
}

export interface PriceBreakdown {
  cabinPrice: number;
  breakfastPrice: number;
  extraGuestFee: number;
  petFee: number;
  parkingFee: number;
  earlyCheckInFee: number;
  lateCheckOutFee: number;
  extrasPrice: number;
  totalPrice: number;
  depositAmount: number;
}

export interface BookingFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export interface BookingFormFieldProps {
  formData: BookingFormData;
  onInputChange: (
    field: keyof BookingFormData,
    value: BookingFormData[keyof BookingFormData]
  ) => void;
  priceBreakdown?: PriceBreakdown;
}
