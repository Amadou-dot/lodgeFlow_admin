'use client';

import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { useResetSettings, useUpdateSettings } from '@/hooks/useSettings';
import type { AppSettings } from '@/types';
import { useEffect, useState } from 'react';
import {
  SettingsActionsSection,
  SettingsAmenitiesSection,
  SettingsBookingSection,
  SettingsCheckInOutSection,
  SettingsPricingSection,
} from './SettingsForm/';

interface SettingsFormProps {
  settings: AppSettings;
  onSettingsUpdate: () => void;
}

export default function SettingsForm({
  settings,
  onSettingsUpdate,
}: SettingsFormProps) {
  const [formData, setFormData] = useState<Partial<AppSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const updateSettings = useUpdateSettings();
  const resetSettings = useResetSettings();
  const { showConfirm, ConfirmDialog } = useConfirmDialog();

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    // Check if there are any changes
    const isChanged = Object.keys(formData).some(key => {
      const currentValue = formData[key as keyof AppSettings];
      const originalValue = settings[key as keyof AppSettings];
      return currentValue !== originalValue;
    });
    setHasChanges(isChanged);
  }, [formData, settings]);

  const handleInputChange = (
    field: keyof AppSettings,
    value: AppSettings[keyof AppSettings]
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync(formData);
      onSettingsUpdate();
      setHasChanges(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleReset = async () => {
    showConfirm({
      title: 'Reset Settings',
      message:
        'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      confirmText: 'Reset',
      confirmColor: 'danger',
      onConfirm: async () => {
        try {
          await resetSettings.mutateAsync();
          onSettingsUpdate();
          setHasChanges(false);
        } catch (error) {
          // Error is handled by the mutation
        }
      },
      isLoading: resetSettings.isPending,
    });
  };

  const handleDiscard = () => {
    setFormData(settings);
    setHasChanges(false);
  };

  return (
    <div className='space-y-6'>
      <SettingsBookingSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsCheckInOutSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsPricingSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsAmenitiesSection
        formData={formData}
        onInputChange={handleInputChange}
      />

      <SettingsActionsSection
        hasChanges={hasChanges}
        onSave={handleSave}
        onDiscard={handleDiscard}
        onReset={handleReset}
        isSaving={updateSettings.isPending}
        isResetting={resetSettings.isPending}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
}
