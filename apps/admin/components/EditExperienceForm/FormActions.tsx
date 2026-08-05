import { Button } from '@heroui/button';

interface FormActionsProps {
  onCancel: () => void;
  onSave: () => void;
  isLoading: boolean;
}

export default function FormActions({
  onCancel,
  onSave,
  isLoading,
}: FormActionsProps) {
  return (
    <div className='flex justify-end gap-2 mt-4'>
      <Button color='danger' variant='light' onPress={onCancel}>
        Cancel
      </Button>
      <Button
        color='primary'
        variant='solid'
        onPress={onSave}
        isLoading={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  );
}
