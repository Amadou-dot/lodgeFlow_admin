'use client';

import { useCreateCustomer, useUpdateCustomer } from '@/hooks/useCustomers';
import type { Customer } from '@/types/clerk';
import { Form } from '@heroui/form';
import { useEffect, useState } from 'react';
import {
  AddressSection,
  BasicInformationSection,
  EmergencyContactSection,
  FormActionsSection,
  type FormData,
  initialFormData,
  PreferencesSection,
} from './AddGuestForm/';

interface AddGuestFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Customer; // Changed from FormData to Customer
  isEditing?: boolean;
}

export default function AddGuestForm({
  onSuccess,
  onCancel,
  initialData,
  isEditing = false,
}: AddGuestFormProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();

  // Update form data when initialData changes (for editing mode)
  useEffect(() => {
    if (isEditing && initialData) {
      setFormData({
        firstName: initialData.first_name || '',
        lastName: initialData.last_name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        password: '', // Never pre-fill password for security
        nationality: initialData.nationality || '',
        nationalId: initialData.nationalId || '',
        address: {
          street: initialData.address?.street || '',
          city: initialData.address?.city || '',
          state: initialData.address?.state || '',
          country: initialData.address?.country || '',
          zipCode: initialData.address?.zipCode || '',
        },
        emergencyContact: {
          firstName: initialData.emergencyContact?.firstName || '',
          lastName: initialData.emergencyContact?.lastName || '',
          phone: initialData.emergencyContact?.phone || '',
          relationship: initialData.emergencyContact?.relationship || '',
        },
        preferences: {
          smokingPreference:
            initialData.preferences?.smokingPreference || 'no-preference',
          dietaryRestrictions: Array.isArray(
            initialData.preferences?.dietaryRestrictions
          )
            ? initialData.preferences.dietaryRestrictions.join(', ')
            : initialData.preferences?.dietaryRestrictions || '',
          accessibilityNeeds: Array.isArray(
            initialData.preferences?.accessibilityNeeds
          )
            ? initialData.preferences.accessibilityNeeds.join(', ')
            : initialData.preferences?.accessibilityNeeds || '',
        },
      });
    }
  }, [isEditing, initialData]);

  const handleInputChange = (field: string, value: string) => {
    const keys = field.split('.');
    setFormData(prev => {
      const updated = { ...prev };
      let current: Record<string, unknown> = updated as Record<string, unknown>;

      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]] as Record<string, unknown>;
      }

      current[keys[keys.length - 1]] = value;
      return updated;
    });

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }

    // Clear mutation error when user starts typing
    if (createCustomerMutation.error) {
      createCustomerMutation.reset();
    }
    if (updateCustomerMutation.error) {
      updateCustomerMutation.reset();
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Required fields
    if (!formData.firstName.trim())
      newErrors.firstName = 'First Name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.nationality.trim())
      newErrors.nationality = 'Nationality is required';
    if (!formData.nationalId.trim())
      newErrors.nationalId = 'National ID is required';

    // Password is required only for new users (not editing)
    if (!isEditing) {
      if (!formData.password.trim()) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters long';
      }
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const submitData = {
        ...formData,
        preferences: {
          ...formData.preferences,
          dietaryRestrictions: formData.preferences.dietaryRestrictions
            ? formData.preferences.dietaryRestrictions
                .split(',')
                .map(s => s.trim())
            : [],
          accessibilityNeeds: formData.preferences.accessibilityNeeds
            ? formData.preferences.accessibilityNeeds
                .split(',')
                .map(s => s.trim())
            : [],
        },
      };

      if (isEditing && initialData) {
        // Include the ID for updating (use Clerk user ID)
        const updateData = { ...submitData, id: initialData.id };
        await updateCustomerMutation.mutateAsync(updateData);
      } else {
        await createCustomerMutation.mutateAsync(submitData);
      }

      // Reset form on success (only for create mode)
      if (!isEditing) {
        setFormData(initialFormData);
      }
      setErrors({});
      onSuccess?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred';
      setErrors({ general: errorMessage });
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSubmit(e);
  };

  const isLoading =
    createCustomerMutation.isPending || updateCustomerMutation.isPending;

  return (
    <Form
      onSubmit={onSubmit}
      className='w-full space-y-6'
      validationBehavior='native'
    >
      <div className='flex flex-col my-4'>
        <h2 className='text-xl font-bold'>
          {isEditing ? 'Edit Guest' : 'Add New Guest'}
        </h2>
        <p className='text-small text-default-600'>
          {isEditing
            ? 'Update the guest information below'
            : 'Fill in the guest information below'}
        </p>
      </div>

      {(errors.general ||
        createCustomerMutation.error ||
        updateCustomerMutation.error) && (
        <div className='bg-danger-50 border border-danger-200 p-3 rounded-lg'>
          <p className='text-danger-600 text-sm'>
            {errors.general ||
              createCustomerMutation.error?.message ||
              updateCustomerMutation.error?.message}
          </p>
        </div>
      )}

      <BasicInformationSection
        formData={formData}
        errors={errors}
        onInputChange={handleInputChange}
        isEditing={isEditing}
      />

      <AddressSection formData={formData} onInputChange={handleInputChange} />

      <EmergencyContactSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <PreferencesSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <FormActionsSection
        onCancel={onCancel}
        isLoading={isLoading}
        isEditing={isEditing}
      />
    </Form>
  );
}
