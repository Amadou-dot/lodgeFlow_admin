import { Button } from '@heroui/button';

interface FormActionsProps {
  onCancel?: () => void;
  isLoading: boolean;
}

export default function FormActions({ onCancel, isLoading }: FormActionsProps) {
  return (
    <div className='flex gap-4 justify-end'>
      {onCancel && (
        <Button variant='bordered' onPress={onCancel} type='button'>
          Cancel
        </Button>
      )}
      <Button
        type='submit'
        color='primary'
        variant='solid'
        isLoading={isLoading}
      >
        Create Booking
      </Button>
    </div>
  );
}
