import { Button } from '@heroui/button';

interface FormActionsSectionProps {
  onCancel?: () => void;
  isLoading: boolean;
  isEditing: boolean;
}

export default function FormActionsSection({
  onCancel,
  isLoading,
  isEditing,
}: FormActionsSectionProps) {
  return (
    <div className='flex gap-3 justify-end pt-2 w-full mb-4'>
      {onCancel && (
        <Button variant='bordered' onPress={onCancel} isDisabled={isLoading}>
          Cancel
        </Button>
      )}
      <Button
        color='primary'
        variant='solid'
        type='submit'
        isLoading={isLoading}
      >
        {isLoading
          ? isEditing
            ? 'Updating...'
            : 'Creating...'
          : isEditing
            ? 'Update Guest'
            : 'Create Guest'}
      </Button>
    </div>
  );
}
