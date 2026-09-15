'use client';

import AddGuestForm from '@/components/AddGuestForm';
import { ArrowLeftIcon } from '@/components/icons';
import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';
import { useRouter } from 'next/navigation';

export default function NewGuestPage() {
  const router = useRouter();

  const handleSuccess = () => {
    // Navigate back to guests list with success message
    router.push('/guests?created=true');
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className='container mx-auto px-4 py-8 max-w-5xl'>
      {/* Header */}
      <div className='flex items-center gap-4 mb-8'>
        <Button
          isIconOnly
          variant='light'
          onPress={() => router.back()}
          aria-label='Go back'
        >
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className='text-3xl font-bold'>Add New Guest</h1>
          <p className='text-default-600 mt-1'>
            Create a new guest profile for bookings and reservations
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card className='shadow-lg'>
        <CardBody className='p-8'>
          <AddGuestForm onSuccess={handleSuccess} onCancel={handleCancel} />
        </CardBody>
      </Card>
    </div>
  );
}
