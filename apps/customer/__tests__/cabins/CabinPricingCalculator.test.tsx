import { fireEvent, render, screen } from '@testing-library/react';
import type { DatePickerProps } from '@heroui/date-picker';
import type { CalendarDate } from '@internationalized/date';
import type { ReactNode } from 'react';
import CabinPricingCalculator from '@/components/CabinPricingCalculator';

// The shared framer-motion test double does not implement Accordion's LayoutGroup.
jest.mock('@heroui/accordion', () => ({
  Accordion: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
  AccordionItem: ({
    title,
    children,
  }: {
    title: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));
jest.mock('@heroui/ripple', () => ({
  ...jest.requireActual<Record<string, unknown>>('@heroui/ripple'),
  Ripple: () => null,
}));

jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    data: {
      breakfastPrice: 2.5,
      petFee: 0,
      parkingFee: 0,
      earlyCheckInFee: 3,
      lateCheckOutFee: 0,
      allowPets: false,
      parkingIncluded: true,
    },
  }),
}));
jest.mock('@heroui/date-picker', () => {
  const { parseDate } = jest.requireActual<
    typeof import('@internationalized/date')
  >('@internationalized/date');
  return {
    DatePicker: ({
      label,
      onChange,
      isDisabled,
    }: DatePickerProps<CalendarDate>) => (
      <button
        disabled={isDisabled}
        onClick={() =>
          onChange?.(
            parseDate(label === 'Check-in' ? '2040-01-01' : '2040-01-04')
          )
        }
      >
        Choose {label}
      </button>
    ),
  };
});

test('preview retains fixed ungrouped strings, fractional price arithmetic and per-night extras', () => {
  render(<CabinPricingCalculator discount={1} price={1001.005} />);
  expect(screen.getByText('$1000.00/night')).toBeInTheDocument();
  expect(screen.getByText('Save $1.00/night')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Choose Check-in' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose Check-out' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Breakfast/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Early check-in/ }));
  expect(screen.getByText('$3000.01')).toBeInTheDocument();
  expect(screen.getByText('-$3.00')).toBeInTheDocument();
  expect(screen.getByText('+$7.50')).toBeInTheDocument();
  expect(screen.getByText('+$3.00')).toBeInTheDocument();
  expect(screen.getByText('$3010.51')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear Dates' }));
  expect(
    screen.getByText('Select check-in and check-out dates to see pricing.')
  ).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Breakfast/ })).not.toBeChecked();
});
