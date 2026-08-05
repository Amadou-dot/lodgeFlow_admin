'use client';

import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

// Error Icon Component
const ErrorIcon = () => (
  <AlertTriangle className='w-16 h-16 text-danger-500 mx-auto mb-4' />
);

// Refresh Icon Component
const RefreshIcon = () => <RefreshCw className='w-4 h-4' />;

// Home Icon Component
const HomeIcon = () => <Home className='w-4 h-4' />;

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service

    console.error('Application Error:', error);
  }, [error]);
  const router = useRouter();

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className='min-h-screen bg-background flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardBody className='text-center p-8'>
          <ErrorIcon />

          <h1 className='text-2xl font-bold text-foreground mb-2'>
            Oops! Something went wrong
          </h1>

          <p className='text-default-600 mb-6 leading-relaxed'>
            We encountered an unexpected error. Don't worry, our team has been
            notified and we're working to fix it.
          </p>

          {/* Error details for development */}
          {process.env.NODE_ENV === 'development' && (
            <Card className='mb-6 bg-danger-50 border border-danger-200'>
              <CardBody className='p-4'>
                <h3 className='text-sm font-semibold text-danger-800 mb-2'>
                  Error Details (Development Only)
                </h3>
                <p className='text-xs text-danger-700 font-mono text-left break-all'>
                  {error.message}
                </p>
              </CardBody>
            </Card>
          )}

          <div className='flex flex-col sm:flex-row gap-3'>
            <Button
              color='primary'
              variant='solid'
              onPress={reset}
              startContent={<RefreshIcon />}
              className='flex-1'
            >
              Try Again
            </Button>

            <Button
              color='default'
              variant='bordered'
              onPress={handleGoHome}
              startContent={<HomeIcon />}
              className='flex-1'
            >
              Go Home
            </Button>
          </div>

          <p className='text-xs text-default-400 mt-6'>
            Error ID: {Date.now().toString(36)}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
