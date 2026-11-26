'use client';

import { Card, CardBody } from '@heroui/card';
import { Spinner } from '@heroui/spinner';
import SettingsForm from '@/components/SettingsForm';
import { useState } from 'react';
import { SettingsAccessError, useSettings } from '@/hooks/useSettings';

export default function SettingsPage() {
  const { data: settings, isLoading, error, mutate } = useSettings();

  // AuthGuard unmounts this page when staff access or Clerk identity changes.
  // A Settings read denial also invalidates the editor if the guard is still mounted.
  const denied = error instanceof SettingsAccessError;
  const [lastRead, setLastRead] = useState(settings);
  if (denied && lastRead) setLastRead(undefined);
  else if (!error && settings && settings !== lastRead) setLastRead(settings);
  const editorSettings = denied ? undefined : (settings ?? lastRead);
  const unavailable = Boolean(error || isLoading || !settings);

  return (
    <div className='container mx-auto px-4 py-8'>
      {error ? (
        <Card className='bg-danger-50 border-danger-200'>
          <CardBody>
            <p className='text-danger'>
              Error loading settings: {error.message}
            </p>
          </CardBody>
        </Card>
      ) : unavailable ? (
        <div className='flex justify-center items-center py-12'>
          <Spinner size='lg' label='Loading settings...' />
        </div>
      ) : (
        <div className='mb-8'>
          <h1 className='text-3xl font-bold'>Settings</h1>
          <p className='text-default-600 mt-1'>
            Configure your hotel management preferences and policies
          </p>
        </div>
      )}
      {editorSettings && (
        <SettingsForm
          settings={editorSettings}
          unavailable={unavailable}
          onSettingsUpdate={() => {
            void mutate();
          }}
        />
      )}
    </div>
  );
}
