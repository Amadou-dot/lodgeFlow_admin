import { Input } from '@heroui/input';
import { NumberInput } from '@heroui/number-input';
import { Select, SelectItem } from '@heroui/select';
import Container from './Container';
import type { ExperienceSectionProps } from './types';

export default function BasicInformationSection({
  editedItem,
  onInputChange,
}: ExperienceSectionProps) {
  return (
    <Container>
      <Input
        label='Experience Title'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.name}
        onValueChange={value => onInputChange('name', value)}
      />
      <NumberInput
        label='Experience Price'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.price}
        onValueChange={value => onInputChange('price', value)}
      />
      <Input
        label='Experience Duration'
        labelPlacement='inside'
        radius='sm'
        description='Ex: 2 hours, Half day, Full day'
        value={editedItem.duration || ''}
        onValueChange={value => onInputChange('duration', value)}
      />
      <Input
        label='Experience Category'
        labelPlacement='inside'
        radius='sm'
        description='Ex: Adventure, Relaxation, Cultural'
        value={editedItem.category || ''}
        onValueChange={value => onInputChange('category', value)}
      />
      <Select
        label='Difficulty Level'
        labelPlacement='inside'
        radius='sm'
        selectedKeys={editedItem.difficulty ? [editedItem.difficulty] : []}
        onSelectionChange={keys => {
          const selectedKey = Array.from(keys)[0] as string;
          onInputChange('difficulty', selectedKey);
        }}
      >
        <SelectItem key='Easy'>Easy</SelectItem>
        <SelectItem key='Moderate'>Moderate</SelectItem>
        <SelectItem key='Challenging'>Challenging</SelectItem>
      </Select>
      <Input
        label='Tags (comma-separated)'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.tags?.join(', ') || ''}
        onValueChange={value =>
          onInputChange(
            'tags',
            value
              .split(',')
              .map(tag => tag.trim())
              .filter(tag => tag)
          )
        }
      />
      <Input
        label='Experience Location'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.location || ''}
        onValueChange={value => onInputChange('location', value)}
      />
      <Input
        label='Seasonality'
        labelPlacement='inside'
        radius='sm'
        value={editedItem.seasonality || ''}
        onValueChange={value => onInputChange('seasonality', value)}
      />
    </Container>
  );
}
