import { Button } from '@heroui/button';
import { Card, CardBody } from '@heroui/card';

interface SettingsActionsSectionProps {
  hasChanges: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
  isSaving: boolean;
  isResetting: boolean;
}

export default function SettingsActionsSection({
  hasChanges,
  onSave,
  onDiscard,
  onReset,
  isSaving,
  isResetting,
}: SettingsActionsSectionProps) {
  return (
    <Card>
      <CardBody>
        <div className='flex flex-col sm:flex-row gap-3 justify-between'>
          <div className='flex gap-3'>
            <Button
              color='primary'
              onPress={onSave}
              isLoading={isSaving}
              isDisabled={!hasChanges}
            >
              Save Changes
            </Button>
            {hasChanges && (
              <Button color='default' variant='bordered' onPress={onDiscard}>
                Discard Changes
              </Button>
            )}
          </div>

          <Button
            color='danger'
            variant='bordered'
            onPress={onReset}
            isLoading={isResetting}
          >
            Reset to Defaults
          </Button>
        </div>

        {hasChanges && (
          <p className='text-sm text-warning mt-3'>
            You have unsaved changes. Don&apos;t forget to save your settings.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
