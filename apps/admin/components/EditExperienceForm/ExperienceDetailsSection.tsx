import { Input, Textarea } from '@heroui/input';
import Container from './Container';
import type { ExperienceSectionProps } from './types';

export default function ExperienceDetailsSection({
  editedItem,
  onInputChange,
}: ExperienceSectionProps) {
  return (
    <Container>
      <Textarea
        label='Experience Includes (one per line)'
        labelPlacement='inside'
        radius='sm'
        description='Ex: Equipment rental, Professional guide, Lunch'
        value={editedItem.includes?.join('\n') || ''}
        onValueChange={value =>
          onInputChange(
            'includes',
            value.split('\n').filter(line => line.trim())
          )
        }
        minRows={3}
      />
      <Input
        label='What to bring (comma-separated)'
        labelPlacement='inside'
        radius='sm'
        description='Ex: Sunscreen, Water Bottle, Hat'
        value={editedItem.whatToBring?.join(', ') || ''}
        onValueChange={value =>
          onInputChange(
            'whatToBring',
            value
              .split(',')
              .map(item => item.trim())
              .filter(item => item)
          )
        }
      />
      <Input
        label='Requirements (comma-separated)'
        labelPlacement='inside'
        radius='sm'
        description='Ex: No pets, Must be 18+, Ability to swim'
        value={editedItem.requirements?.join(', ') || ''}
        onValueChange={value =>
          onInputChange(
            'requirements',
            value
              .split(',')
              .map(req => req.trim())
              .filter(req => req)
          )
        }
      />
      <Textarea
        label='Available Times (one per line)'
        labelPlacement='inside'
        radius='sm'
        description='Ex: Weekends, Weekdays, Mornings'
        value={editedItem.available?.join('\n') || ''}
        onValueChange={value =>
          onInputChange(
            'available',
            value.split('\n').filter(line => line.trim())
          )
        }
        minRows={2}
      />
    </Container>
  );
}
