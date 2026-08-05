'use client';

import type {
  BookingFormData,
  PriceBreakdown as PriceBreakdownType,
} from '@/hooks/useBookingForm';
import type { Cabin, Customer, AppSettings } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import {
  BookingDatesGuests,
  BookingExtras,
  CabinSelection,
  CustomerSelection,
  PaymentInformation,
  PriceBreakdown,
  SpecialRequests,
} from './BookingForm/index';

/**
 * Props for BookingFormFields component
 *
 * The props are organized into logical groups:
 *
 * 1. Form State:
 *    - formData, specialRequestInput, priceBreakdown
 *
 * 2. Derived Values:
 *    - selectedCabin, numNights
 *
 * 3. Data Sources:
 *    - cabins, customers, customersLoading, settings
 *
 * 4. Customer Selection UI:
 *    - scrollerRef, isCustomerOpen, setIsCustomerOpen, handleCustomerSearch
 *
 * 5. Form Handlers:
 *    - handleInputChange, addSpecialRequest, removeSpecialRequest, setSpecialRequestInput
 *
 * 6. Utilities:
 *    - formatCurrency
 *
 * 7. Display Options:
 *    - showPayment, showPricing
 */
interface BookingFormFieldsProps {
  // Form State
  formData: BookingFormData;
  specialRequestInput: string;
  priceBreakdown: PriceBreakdownType;

  // Derived Values
  selectedCabin: Cabin | undefined;
  numNights: number;

  // Data Sources
  cabins: Cabin[];
  customers: Customer[];
  customersLoading: boolean;
  settings: AppSettings | undefined;

  // Customer Selection UI
  scrollerRef: React.RefObject<HTMLElement>;
  isCustomerOpen: boolean;
  setIsCustomerOpen: (open: boolean) => void;
  handleCustomerSearch: (searchValue: string) => void;

  // Form Handlers
  handleInputChange: (
    field: keyof BookingFormData,
    value: string | number | boolean | string[]
  ) => void;
  addSpecialRequest: () => void;
  removeSpecialRequest: (index: number) => void;
  setSpecialRequestInput: (value: string) => void;

  // Utilities
  formatCurrency: (amount: number) => string;

  // Display Options
  showPayment?: boolean;
  showPricing?: boolean;

  // Edit mode
  excludeBookingId?: string;
}

export default function BookingFormFields({
  formData,
  specialRequestInput,
  priceBreakdown,
  selectedCabin,
  numNights,
  cabins,
  customers,
  customersLoading,
  settings,
  scrollerRef,
  setIsCustomerOpen,
  handleInputChange,
  handleCustomerSearch,
  addSpecialRequest,
  removeSpecialRequest,
  setSpecialRequestInput,
  formatCurrency,
  showPayment = true,
  showPricing = true,
  excludeBookingId,
}: BookingFormFieldsProps) {
  return (
    <div className='space-y-6'>
      {/* Cabin Selection */}
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>Cabin Selection</h3>
        </CardHeader>
        <CardBody>
          <CabinSelection
            formData={formData}
            onInputChange={handleInputChange}
            cabins={cabins}
            formatCurrency={formatCurrency}
          />
        </CardBody>
      </Card>

      {/* Customer Selection */}
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>Customer Selection</h3>
        </CardHeader>
        <CardBody>
          <CustomerSelection
            formData={formData}
            onInputChange={handleInputChange}
            customers={customers}
            customersLoading={customersLoading}
            scrollerRef={scrollerRef}
            onOpenChange={setIsCustomerOpen}
            onSearchChange={handleCustomerSearch}
          />
        </CardBody>
      </Card>

      {/* Booking Dates & Guests */}
      <Card>
        <CardHeader>
          <h3 className='text-lg font-semibold'>Booking Details</h3>
        </CardHeader>
        <CardBody className='space-y-4'>
          <BookingDatesGuests
            formData={formData}
            onInputChange={handleInputChange}
            selectedCabin={selectedCabin}
            numNights={numNights}
            excludeBookingId={excludeBookingId}
            maxGuestsPerBooking={settings?.maxGuestsPerBooking}
          />
        </CardBody>
      </Card>

      {/* Extras */}
      <BookingExtras
        formData={formData}
        onInputChange={handleInputChange}
        settings={settings}
        priceBreakdown={priceBreakdown}
        formatCurrency={formatCurrency}
      />

      {/* Special Requests */}
      <SpecialRequests
        formData={formData}
        onInputChange={handleInputChange}
        specialRequestInput={specialRequestInput}
        onSpecialRequestInputChange={setSpecialRequestInput}
        onAddSpecialRequest={addSpecialRequest}
        onRemoveSpecialRequest={removeSpecialRequest}
      />

      {/* Payment Information */}
      {showPayment && (
        <PaymentInformation
          formData={formData}
          onInputChange={handleInputChange}
          settings={settings}
          priceBreakdown={priceBreakdown}
        />
      )}

      {/* Price Breakdown */}
      {showPricing && (
        <PriceBreakdown
          priceBreakdown={priceBreakdown}
          numNights={numNights}
          settings={settings}
        />
      )}
    </div>
  );
}
