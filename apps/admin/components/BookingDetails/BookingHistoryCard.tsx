import { Card, CardBody, CardHeader } from '@heroui/card';
import { format } from 'date-fns';

interface BookingHistoryCardProps {
  createdAt?: string;
  updatedAt?: string;
}

export default function BookingHistoryCard({
  createdAt,
  updatedAt,
}: BookingHistoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className='text-lg font-semibold'>Booking History</h2>
      </CardHeader>
      <CardBody>
        <div className='space-y-3 text-sm'>
          <div className='flex justify-between'>
            <span className='text-default-500'>Created</span>
            <span>
              {createdAt
                ? format(new Date(createdAt), 'MMM dd, yyyy')
                : 'Unknown'}
            </span>
          </div>
          <div className='flex justify-between'>
            <span className='text-default-500'>Last Updated</span>
            <span>
              {updatedAt
                ? format(new Date(updatedAt), 'MMM dd, yyyy')
                : 'Unknown'}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
