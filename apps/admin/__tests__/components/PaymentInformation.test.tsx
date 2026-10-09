import { render, screen } from '@testing-library/react';
import PaymentInformation from '@/components/BookingForm/PaymentInformation';
import type {
  BookingFormData,
  PriceBreakdown,
} from '@/components/BookingForm/types';

const formData: BookingFormData = {
  cabin: '',
  customer: '',
  checkInDate: '',
  checkOutDate: '',
  numGuests: 1,
  hasBreakfast: false,
  hasPets: false,
  hasParking: false,
  hasEarlyCheckIn: false,
  hasLateCheckOut: false,
  observations: '',
  specialRequests: [],
  paymentMethod: '',
  isPaid: false,
  depositPaid: false,
};
const priceBreakdown: PriceBreakdown = {
  cabinPrice: 2000,
  breakfastPrice: 0,
  extraGuestFee: 0,
  petFee: 0,
  parkingFee: 0,
  earlyCheckInFee: 0,
  lateCheckOutFee: 0,
  extrasPrice: 0,
  totalPrice: 2000,
  depositAmount: 1234.5,
};

test.each([
  ['EUR', 'Required deposit: €1,234.50'],
  ['JPY', 'Required deposit: ¥1,235'],
])(
  'deposit display preserves currency-specific precision for %s',
  (currency, text) => {
    render(
      <PaymentInformation
        formData={formData}
        onInputChange={jest.fn()}
        priceBreakdown={priceBreakdown}
        settings={{ currency, requireDeposit: true }}
      />
    );
    expect(screen.getByText(text)).toBeInTheDocument();
  }
);

test('does not display a deposit when Settings does not require one', () => {
  render(
    <PaymentInformation
      formData={formData}
      onInputChange={jest.fn()}
      priceBreakdown={priceBreakdown}
      settings={{ currency: 'EUR', requireDeposit: false }}
    />
  );
  expect(screen.queryByText(/Required deposit/)).not.toBeInTheDocument();
});

test('negative draft deposit amounts remain renderable while guest input is being edited', () => {
  render(
    <PaymentInformation
      formData={{ ...formData, numGuests: -100 }}
      onInputChange={jest.fn()}
      priceBreakdown={{ ...priceBreakdown, depositAmount: -124 }}
      settings={{ currency: 'EUR', requireDeposit: true }}
    />
  );
  expect(screen.getByText('Required deposit: -€124.00')).toBeInTheDocument();
});
