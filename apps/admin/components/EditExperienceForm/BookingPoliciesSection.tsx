import { Checkbox } from '@heroui/checkbox';
import { Input } from '@heroui/input';
import { NumberInput } from '@heroui/number-input';
import Container from './Container';
import type { ExperienceSectionProps } from './types';

export default function BookingPoliciesSection({
  editedItem,
  onInputChange,
}: ExperienceSectionProps) {
  return (
    <Container>
      <Input
        label='Call to Action Text'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.ctaText || ''}
        onValueChange={value => onInputChange('ctaText', value)}
      />
      <Input
        label='Cancellation Policy'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.cancellationPolicy || ''}
        onValueChange={value => onInputChange('cancellationPolicy', value)}
      />
      <NumberInput
        label='Max Participants'
        labelPlacement='inside'
        min={1}
        radius='sm'
        value={editedItem.maxParticipants || 1}
        onValueChange={value => onInputChange('maxParticipants', value)}
      />
      <NumberInput
        label='Minimum Age'
        labelPlacement='inside'
        min={0}
        radius='sm'
        value={editedItem.minAge || 0}
        onValueChange={value => onInputChange('minAge', value)}
      />
      <div className='md:col-span-2'>
        <Checkbox
          isSelected={editedItem.isPopular || false}
          onValueChange={value => onInputChange('isPopular', value)}
        >
          Mark as popular
        </Checkbox>
      </div>
    </Container>
  );
}
