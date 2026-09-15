import { Customer } from '@/types';
import { getInitials, getLoyaltyTier } from '@/utils/utilityFunctions';
import { Avatar } from '@heroui/avatar';
import { Card, CardBody } from '@heroui/card';
import { Chip } from '@heroui/chip';
import Link from 'next/link';

interface GuestCardProps {
  customer: Customer;
}

export default function GuestCard({ customer }: GuestCardProps) {
  const loyalty = getLoyaltyTier(customer.totalSpent);
  return (
    <Link key={customer.id} href={`/guests/${customer.id}`}>
      <Card className='hover:shadow-lg transition-all duration-200 cursor-pointer h-full'>
        <CardBody className='p-4'>
          <div className='flex items-start gap-3'>
            <Avatar
              name={getInitials(customer.name)}
              src={customer.image_url}
              className='flex-shrink-0'
              color='primary'
            />
            <div className='flex-1 min-w-0'>
              <h3 className='font-semibold text-sm truncate'>
                {customer.name}
              </h3>
              <p className='text-xs text-default-600 truncate'>
                {customer.email}
              </p>
              <p className='text-xs text-default-500 mt-1'>
                {customer.nationality || 'Not specified'}
              </p>
            </div>
          </div>

          <div className='mt-4 space-y-2'>
            <div className='flex justify-between items-center'>
              <span className='text-xs text-default-600'>Bookings:</span>
              <span className='text-xs font-medium'>
                {customer.totalBookings}
              </span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-xs text-default-600'>Spent:</span>
              <span className='text-xs font-medium'>
                ${customer.totalSpent.toLocaleString()}
              </span>
            </div>
            <div className='flex justify-between items-center'>
              <span className='text-xs text-default-600'>Status:</span>
              <Chip
                size='sm'
                color={loyalty.color}
                variant='flat'
                className='text-xs'
              >
                {loyalty.tier}
              </Chip>
            </div>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
