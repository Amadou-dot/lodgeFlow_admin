import { Input } from '@heroui/input';
import Container from './Container';
import type { ExperienceSectionProps } from './types';

export default function MediaVisualsSection({
  editedItem,
  onInputChange,
}: ExperienceSectionProps) {
  return (
    <Container>
      <Input
        label='Experience Image URL'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.image || ''}
        onValueChange={value => onInputChange('image', value)}
      />
      <Input
        label='Image Gallery URLs (comma-separated)'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.gallery?.join(', ') || ''}
        onValueChange={value =>
          onInputChange(
            'gallery',
            value
              .split(',')
              .map(url => url.trim())
              .filter(url => url)
          )
        }
      />
    </Container>
  );
}
