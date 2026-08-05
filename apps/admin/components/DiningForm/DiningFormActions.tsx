import { Dining } from '@/types';
import { Button } from '@heroui/button';

interface DiningFormActionsProps {
  dining?: Partial<Dining>;
  onCancel: () => void;
  isLoading: boolean;
}

export default function DiningFormActions({
  dining,
  onCancel,
  isLoading,
}: DiningFormActionsProps) {
  return (
    <div className='flex gap-3 pt-4 border-t'>
      <Button
        type='button'
        variant='bordered'
        onPress={onCancel}
        className='flex-1'
      >
        Cancel
      </Button>
      <Button
        type='submit'
        color='primary'
        isLoading={isLoading}
        className='flex-1'
      >
        {dining?._id ? 'Update' : 'Create'} Dining Item
      </Button>
    </div>
  );
}
