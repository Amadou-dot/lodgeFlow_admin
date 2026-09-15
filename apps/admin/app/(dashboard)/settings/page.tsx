'use client';

import { Card, CardBody } from '@heroui/card';
import { Spinner } from '@heroui/spinner';
import SettingsForm from '@/components/SettingsForm';
import { useSettings } from '@/hooks/useSettings';

export default function SettingsPage() {
  const { data: settings, isLoading, error, mutate } = useSettings();

  const handleSettingsUpdate = () => {
    // Revalidate the settings data
    mutate();
  };

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody>
            <p className='text-danger'>
              Error loading settings: {error.message}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (isLoading || !settings) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <div className='flex justify-center items-center py-12'>
          <Spinner size='lg' label='Loading settings...' />
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Settings</h1>
        <p className='text-default-600 mt-1'>
          Configure your hotel management preferences and policies
        </p>
      </div>

      {/* Settings Form */}
      <SettingsForm
        settings={settings}
        onSettingsUpdate={handleSettingsUpdate}
      />
    </div>
  );
}
