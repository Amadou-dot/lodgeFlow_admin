import { Input, Textarea } from '@heroui/input';
import Container from './Container';
import type { ExperienceSectionProps } from './types';

export default function DescriptionsSection({
  editedItem,
  onInputChange,
}: ExperienceSectionProps) {
  return (
    <Container>
      <Textarea
        label='Short Description'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.description}
        onValueChange={value => onInputChange('description', value)}
        minRows={3}
      />
      <Textarea
        label='Long Description'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.longDescription || ''}
        onValueChange={value => onInputChange('longDescription', value)}
        minRows={3}
      />
      <Input
        label='Experience Highlights (comma-separated)'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.highlights?.join(', ') || ''}
        onValueChange={value =>
          onInputChange(
            'highlights',
            value
              .split(',')
              .map(highlight => highlight.trim())
              .filter(highlight => highlight)
          )
        }
      />
    </Container>
  );
}
