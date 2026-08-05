import { useCabins } from '@/hooks/useCabins';
import { useInfiniteCustomers } from '@/hooks/useInfiniteCustomers';
import { useSettings } from '@/hooks/useSettings';
import type { PopulatedBooking } from '@/types';
import { calcNumNights } from '@/utils/utilityFunctions';
import { useInfiniteScroll } from '@heroui/use-infinite-scroll';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BookingFormData,
  PriceBreakdown,
} from '@/components/BookingForm/types';

export type { BookingFormData, PriceBreakdown };

const getInitialFormData = (booking?: PopulatedBooking): BookingFormData => {
  if (booking) {
    return {
      cabin:
        typeof booking.cabin === 'string'
          ? booking.cabin
          : booking.cabin._id.toString(),
      customer:
        typeof booking.customer === 'string'
          ? booking.customer
          : booking.customer.id,
      checkInDate:
        booking.checkInDate instanceof Date
          ? booking.checkInDate.toISOString().split('T')[0]
          : booking.checkInDate.split('T')[0],
      checkOutDate:
        booking.checkOutDate instanceof Date
          ? booking.checkOutDate.toISOString().split('T')[0]
          : booking.checkOutDate.split('T')[0],
      numGuests: booking.numGuests,
      hasBreakfast: booking.extras?.hasBreakfast || false,
      hasPets: booking.extras?.hasPets || false,
      hasParking: booking.extras?.hasParking || false,
      hasEarlyCheckIn: booking.extras?.hasEarlyCheckIn || false,
      hasLateCheckOut: booking.extras?.hasLateCheckOut || false,
      observations: booking.observations || '',
      specialRequests: booking.specialRequests || [],
      paymentMethod: booking.paymentMethod || '',
      isPaid: booking.isPaid,
      depositPaid: booking.depositPaid,
    };
  }

  return {
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
};

export const useBookingForm = (initialBooking?: PopulatedBooking) => {
  const [formData, setFormData] = useState<BookingFormData>(() =>
    getInitialFormData(initialBooking)
  );

  const [specialRequestInput, setSpecialRequestInput] = useState('');
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown>({
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
  });

  // Data fetching hooks
  const { data: cabins } = useCabins();
  const {
    customers,
    hasMore,
    isLoading: customersLoading,
    onLoadMore,
    searchCustomers,
  } = useInfiniteCustomers();
  const { data: settings } = useSettings();

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
    () => calcNumNights(formData.checkInDate, formData.checkOutDate),
    [formData.checkInDate, formData.checkOutDate]
  );

  // Price calculation effect
  useEffect(() => {
    if (!selectedCabin || !settings || numNights <= 0) {
      setPriceBreakdown({
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
      });
      return;
    }

    const discountedPrice =
      selectedCabin.discount > 0
        ? selectedCabin.price - selectedCabin.discount
        : selectedCabin.price;
    const cabinPrice = discountedPrice * numNights;

    const breakfastPrice = formData.hasBreakfast
      ? settings.breakfastPrice * formData.numGuests * numNights
      : 0;

    const cabinExtraGuestFee = selectedCabin.extraGuestFee ?? 0;
    const extraGuestFee =
      formData.numGuests > 1 && cabinExtraGuestFee > 0
        ? (formData.numGuests - 1) * cabinExtraGuestFee * numNights
        : 0;

    const petFee = formData.hasPets ? settings.petFee * numNights : 0;

    const parkingFee =
      formData.hasParking && !settings.parkingIncluded
        ? settings.parkingFee * numNights
        : 0;

    const earlyCheckInFee = formData.hasEarlyCheckIn
      ? settings.earlyCheckInFee
      : 0;
    const lateCheckOutFee = formData.hasLateCheckOut
      ? settings.lateCheckOutFee
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
      ? Math.round(totalPrice * (settings.depositPercentage / 100))
      : 0;

    setPriceBreakdown({
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
    });
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
    (field: keyof BookingFormData, value: unknown) => {
      setFormData(prev => ({ ...prev, [field]: value }));
    },
    []
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
  }, [formData, selectedCabin, settings, numNights]);

  // Utility functions - memoized
  const formatCurrency = useCallback(
    (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: settings?.currency || 'USD',
      }).format(amount);
    },
    [settings?.currency]
  );

  // Build booking data for API - memoized
  const buildBookingData = useCallback(() => {
    return {
      cabin: formData.cabin,
      customer: formData.customer,
      checkInDate: new Date(formData.checkInDate),
      checkOutDate: new Date(formData.checkOutDate),
      numNights,
      numGuests: formData.numGuests,
      status: 'unconfirmed' as const,
      cabinPrice:
        selectedCabin!.discount > 0
          ? selectedCabin!.price - selectedCabin!.discount
          : selectedCabin!.price,
      extrasPrice: priceBreakdown.extrasPrice,
      totalPrice: priceBreakdown.totalPrice,
      isPaid: formData.isPaid,
      paymentMethod:
        (formData.paymentMethod as
          | 'cash'
          | 'card'
          | 'bank-transfer'
          | 'online') || undefined,
      extras: {
        hasBreakfast: formData.hasBreakfast,
        breakfastPrice: priceBreakdown.breakfastPrice,
        hasPets: formData.hasPets,
        petFee: priceBreakdown.petFee,
        hasParking: formData.hasParking,
        parkingFee: priceBreakdown.parkingFee,
        hasEarlyCheckIn: formData.hasEarlyCheckIn,
        earlyCheckInFee: priceBreakdown.earlyCheckInFee,
        hasLateCheckOut: formData.hasLateCheckOut,
        lateCheckOutFee: priceBreakdown.lateCheckOutFee,
      },
      observations: formData.observations || undefined,
      specialRequests: formData.specialRequests,
      depositPaid: formData.depositPaid,
      depositAmount: priceBreakdown.depositAmount,
      remainingAmount:
        priceBreakdown.totalPrice -
        (formData.depositPaid ? priceBreakdown.depositAmount : 0),
    };
  }, [formData, selectedCabin, priceBreakdown, numNights]);

  return {
    // State
    formData,
    specialRequestInput,
    priceBreakdown,

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
    addSpecialRequest,
    removeSpecialRequest,
    setSpecialRequestInput,

    // Utilities
    validateForm,
    formatCurrency,
    buildBookingData,
  };
};
