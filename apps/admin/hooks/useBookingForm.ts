import { useCabins } from '@/hooks/useCabins';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import { useSettings } from '@/hooks/useSettings';
import type { AdminBooking } from '@/types/booking-read';
import {
  calcNumNights,
  formatSettingsCurrency,
} from '@/utils/utilityFunctions';
import { majorAmount, roundMajorAmount } from '@lodgeflow/database/money';
import { useInfiniteScroll } from '@heroui/use-infinite-scroll';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BookingCustomerOption,
  BookingFormData,
  PriceBreakdown,
} from '@/components/BookingForm/types';

import {
  buildBookingCreateInput,
  buildBookingUpdateInput,
  initializeBookingForm,
  pricingInputsChanged,
} from '@/components/BookingForm/booking-form-data';

export type { BookingFormData, PriceBreakdown };

type BookingCustomerSource =
  | { kind: 'create' }
  | {
      kind: 'booking';
      customer: BookingCustomerOption | null;
      initial: BookingFormData;
    };

function useBookingFormDraft({
  initialize,
  customerSource,
}: {
  initialize: () => BookingFormData;
  customerSource: BookingCustomerSource;
}) {
  const [draftData, setFormData] = useState(initialize);
  const [customerSelection, setCustomerSelection] = useState<'saved' | 'draft'>(
    customerSource.kind === 'booking' ? 'saved' : 'draft'
  );
  const [retainedCustomer, setRetainedCustomer] =
    useState<BookingCustomerOption>();
  const savedCustomer =
    customerSource.kind === 'booking' ? customerSource.customer : undefined;
  const [lastSavedCustomerId, setLastSavedCustomerId] = useState(
    savedCustomer?.id
  );
  if (savedCustomer && savedCustomer.id !== lastSavedCustomerId) {
    setLastSavedCustomerId(savedCustomer.id);
  }

  // A null detail profile leaves its prior ID unresolved, even in cached results.
  const unresolvedSavedCustomerId =
    savedCustomer === null ? lastSavedCustomerId : undefined;
  const selectedCustomerId =
    customerSelection === 'saved'
      ? (savedCustomer?.id ?? '')
      : draftData.customer;
  const customerId =
    selectedCustomerId === unresolvedSavedCustomerId ? '' : selectedCustomerId;
  const formData = useMemo(
    () => ({ ...draftData, customer: customerId }),
    [draftData, customerId]
  );

  const [specialRequestInput, setSpecialRequestInput] = useState('');
  // Data fetching hooks
  const { data: cabins } = useCabins();
  const {
    customers: listedCustomers,
    hasMore,
    isLoading: customersLoading,
    onLoadMore,
    searchCustomers,
  } = useInfiniteCustomers();
  const { data: settings } = useSettings();

  const listedCustomer = listedCustomers.find(
    customer => customer.id === formData.customer
  );
  // A prefilled ID can resolve when its page first arrives.
  if (
    customerSelection === 'draft' &&
    listedCustomer &&
    listedCustomer !== retainedCustomer
  ) {
    setRetainedCustomer(listedCustomer);
  }
  const selectedProfile =
    customerSelection === 'saved' ? savedCustomer : retainedCustomer;
  const customers = useMemo(() => {
    const options = unresolvedSavedCustomerId
      ? listedCustomers.filter(
          customer => customer.id !== unresolvedSavedCustomerId
        )
      : listedCustomers;
    return !listedCustomer && selectedProfile?.id === formData.customer
      ? [selectedProfile, ...options]
      : options;
  }, [
    listedCustomer,
    selectedProfile,
    formData.customer,
    listedCustomers,
    unresolvedSavedCustomerId,
  ]);

  // Customer selection state
  const [isCustomerOpen, setIsCustomerOpen] = useState(false);
  const [, scrollerRef] = useInfiniteScroll({
    hasMore,
    isEnabled: isCustomerOpen,
    shouldUseLoader: false,
    onLoadMore,
  });

  // Customer search with debouncing - use ref to avoid dependency issues
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCustomerSearch = useCallback(
    (searchValue: string) => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = setTimeout(() => {
        searchCustomers(searchValue);
      }, 300);
    },
    [searchCustomers]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Derived values - memoized for performance
  const selectedCabin = useMemo(
    () => cabins?.find(cabin => cabin._id.toString() === formData.cabin),
    [cabins, formData.cabin]
  );

  const numNights = useMemo(
    () =>
      calcNumNights({
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
      }),
    [formData.checkInDate, formData.checkOutDate]
  );

  const priceBreakdown = useMemo<PriceBreakdown>(() => {
    if (!selectedCabin || !settings || numNights <= 0) {
      return {
        cabinPrice: 0,
        breakfastPrice: 0,
        extraGuestFee: 0,
        petFee: 0,
        parkingFee: 0,
        earlyCheckInFee: 0,
        lateCheckOutFee: 0,
        extrasPrice: 0,
        totalPrice: 0,
        depositAmount: 0,
      };
    }

    const discount = selectedCabin.discount ?? 0;
    const discountedPrice =
      discount > 0 ? selectedCabin.price - discount : selectedCabin.price;
    const cabinPrice = discountedPrice * numNights;

    const breakfastPrice = formData.hasBreakfast
      ? settings.breakfastPrice * formData.numGuests * numNights
      : 0;

    const cabinExtraGuestFee = selectedCabin.extraGuestFee ?? 0;
    const extraGuestFee =
      formData.numGuests > 1 && cabinExtraGuestFee > 0
        ? (formData.numGuests - 1) * cabinExtraGuestFee * numNights
        : 0;

    const petFee = formData.hasPets ? (settings.petFee ?? 0) * numNights : 0;

    const parkingFee =
      formData.hasParking && !settings.parkingIncluded
        ? (settings.parkingFee ?? 0) * numNights
        : 0;

    const earlyCheckInFee = formData.hasEarlyCheckIn
      ? (settings.earlyCheckInFee ?? 0)
      : 0;
    const lateCheckOutFee = formData.hasLateCheckOut
      ? (settings.lateCheckOutFee ?? 0)
      : 0;

    const extrasPrice =
      breakfastPrice +
      extraGuestFee +
      petFee +
      parkingFee +
      earlyCheckInFee +
      lateCheckOutFee;
    const totalPrice = cabinPrice + extrasPrice;
    const depositAmount = settings.requireDeposit
      ? roundMajorAmount({
          amount: majorAmount(totalPrice * (settings.depositPercentage / 100), {
            precision: 'preserve',
            // Draft guest input can be negative before form validation runs.
            sign: 'signed',
          }),
          rounding: 'whole',
        })
      : 0;

    return {
      cabinPrice,
      breakfastPrice,
      extraGuestFee,
      petFee,
      parkingFee,
      earlyCheckInFee,
      lateCheckOutFee,
      extrasPrice,
      totalPrice,
      depositAmount,
    };
  }, [
    selectedCabin,
    settings,
    numNights,
    formData.hasBreakfast,
    formData.hasPets,
    formData.hasParking,
    formData.hasEarlyCheckIn,
    formData.hasLateCheckOut,
    formData.numGuests,
  ]);

  // Form handlers - memoized to prevent unnecessary re-renders
  const handleInputChange = useCallback(
    <K extends keyof BookingFormData>(field: K, value: BookingFormData[K]) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleCustomerSelection = useCallback(
    (customer: BookingCustomerOption | undefined) => {
      setCustomerSelection('draft');
      setRetainedCustomer(customer);
      handleInputChange('customer', customer?.id ?? '');
    },
    [handleInputChange]
  );

  const addSpecialRequest = useCallback(() => {
    if (specialRequestInput.trim()) {
      setFormData(prev => ({
        ...prev,
        specialRequests: [...prev.specialRequests, specialRequestInput.trim()],
      }));
      setSpecialRequestInput('');
    }
  }, [specialRequestInput]);

  const removeSpecialRequest = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      specialRequests: prev.specialRequests.filter((_, i) => i !== index),
    }));
  }, []);

  const preserveExistingPricing =
    customerSource.kind === 'booking' &&
    !pricingInputsChanged({ formData, initial: customerSource.initial });

  // Validation - memoized with dependencies
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    if (!formData.cabin) errors.push('Please select a cabin');
    if (!formData.customer) errors.push('Please select a customer');
    if (!formData.checkInDate) errors.push('Please select check-in date');
    if (!formData.checkOutDate) errors.push('Please select check-out date');
    if (
      formData.checkInDate &&
      formData.checkOutDate &&
      new Date(formData.checkOutDate) <= new Date(formData.checkInDate)
    ) {
      errors.push('Check-out date must be after check-in date');
    }
    if (formData.numGuests < 1)
      errors.push('Number of guests must be at least 1');
    if (preserveExistingPricing) return errors;
    if (selectedCabin) {
      const maxGuests = settings
        ? Math.min(selectedCabin.capacity, settings.maxGuestsPerBooking)
        : selectedCabin.capacity;
      if (formData.numGuests > maxGuests) {
        errors.push(`Number of guests cannot exceed ${maxGuests}`);
      }
    }
    if (settings && numNights > 0) {
      const effectiveMinNights = Math.max(
        settings.minBookingLength,
        selectedCabin?.minNights ?? 0
      );
      if (numNights < effectiveMinNights) {
        errors.push(`Minimum booking length is ${effectiveMinNights} night(s)`);
      }
    }
    if (settings && numNights > settings.maxBookingLength) {
      errors.push(
        `Maximum booking length is ${settings.maxBookingLength} nights`
      );
    }

    return errors;
  }, [formData, selectedCabin, settings, numNights, preserveExistingPricing]);

  // Utility functions - memoized
  const formatCurrency = useCallback(
    (amount: number) => {
      return formatSettingsCurrency(amount, settings?.currency);
    },
    [settings?.currency]
  );

  return {
    // State
    formData,
    specialRequestInput,
    priceBreakdown,

    preserveExistingPricing,

    // Derived values
    selectedCabin,
    numNights,

    // Data
    cabins: cabins || [],
    customers,
    customersLoading,
    settings,

    // Customer scroll
    scrollerRef,
    isCustomerOpen,
    setIsCustomerOpen,

    // Handlers
    handleInputChange,
    handleCustomerSearch,
    handleCustomerSelection,
    addSpecialRequest,
    removeSpecialRequest,
    setSpecialRequestInput,

    // Utilities
    validateForm,
    formatCurrency,
  };
}

export function useBookingForm() {
  const draft = useBookingFormDraft({
    initialize: initializeBookingForm,
    customerSource: { kind: 'create' },
  });
  return {
    ...draft,
    buildBookingData: () => buildBookingCreateInput(draft.formData),
  };
}

export function useBookingEditForm(booking: AdminBooking) {
  const [initialFormData] = useState(() => initializeBookingForm(booking));
  const draft = useBookingFormDraft({
    initialize: () => initialFormData,
    customerSource: {
      kind: 'booking',
      customer: booking.customer,
      initial: initialFormData,
    },
  });

  return {
    ...draft,
    hasSavedPaymentMethod: Boolean(initialFormData.paymentMethod),
    buildBookingData: () =>
      buildBookingUpdateInput({
        booking,
        formData: draft.formData,
        initial: initialFormData,
      }),
  };
}
