import type { Customer } from '@/types';
import { Card, CardBody, CardHeader } from '@heroui/card';
import { Divider } from '@heroui/divider';
import { User } from '@heroui/user';

interface GuestInformationCardProps {
  customer?: Customer;
  numGuests: number;
  numNights: number;
}

export default function GuestInformationCard({
  customer,
  numGuests,
  numNights,
}: GuestInformationCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className='text-lg font-semibold'>Guest Information</h2>
      </CardHeader>
      <CardBody>
        {customer ? (
          <>
            <User
              name={customer.name || 'Unknown Guest'}
              description={customer.email || 'No email provided'}
              avatarProps={{
                src: customer.image_url,
                name: customer.name
                  ? customer.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .substring(0, 2)
                  : 'UG',
                className: 'bg-primary text-white',
              }}
            />
            <Divider className='my-4' />
            <div className='grid grid-cols-2 gap-4 text-sm'>
              <div className='text-left'>
                <span className='text-default-500'>Phone:</span>
                <p className='font-medium'>
                  {customer.phone || 'Not provided'}
                </p>
              </div>
              <div className='text-left'>
                <span className='text-default-500'>Nationality:</span>
                <p className='font-medium'>
                  {customer.nationality || 'Not provided'}
                </p>
              </div>
              <div className='text-left'>
                <span className='text-default-500'>Guests:</span>
                <p className='font-medium'>
                  {numGuests} guest
                  {numGuests !== 1 ? 's' : ''}
                </p>
              </div>
              <div className='text-left'>
                <span className='text-default-500'>Nights:</span>
                <p className='font-medium'>
                  {numNights} night
                  {numNights !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className='py-4'>
            <p className='text-default-500 text-left'>
              Guest information not available
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
