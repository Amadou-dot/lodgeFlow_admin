import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button } from '@heroui/button';
import { Checkbox } from '@heroui/checkbox';
import { Form } from '@heroui/form';
import { Input, Textarea } from '@heroui/input';
import { NumberInput } from '@heroui/number-input';
import { Select, SelectItem } from '@heroui/select';
import { useState } from 'react';
import type { FormProps } from './AddExperienceForm/types';
import Container from './EditExperienceForm/Container';
export default function AddExperienceForm({
  formData,
  setFormData,
}: FormProps) {
  const keys = ['1', '2', '3', '4', '5'];

  const [isExpanded, setIsExpanded] = useState<Set<string>>(new Set([keys[0]]));
  const expandAll = () => setIsExpanded(new Set(keys));
  const collapseAll = () => setIsExpanded(new Set());

  const handleInputChange = (name: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Form submission logic would go here
  };

  return (
    <Form className='flex flex-col gap-4' onSubmit={onSubmit}>
      <div className='w-full flex justify-end'>
        <Button variant='light' size='sm' color='primary' onPress={collapseAll}>
          Collapse all
        </Button>
        <Button variant='light' size='sm' color='primary' onPress={expandAll}>
          Expand all
        </Button>
      </div>
      <Accordion
        aria-label='Add Experience Form'
        selectionMode='multiple'
        variant='light'
        selectedKeys={isExpanded}
        onSelectionChange={setIsExpanded as () => void}
      >
        <AccordionItem
          key={keys[0]}
          aria-label='Basic Information'
          title='Basic Information'
        >
          <Container>
            <Input
              name='title'
              labelPlacement='inside'
              label='Experience Title'
              // placeholder='Experience Title'
              aria-label='Experience Title'
              radius='sm'
              value={formData.title || ''}
              onValueChange={value => handleInputChange('title', value)}
            />
            <NumberInput
              name='price'
              // placeholder='Experience Price'
              labelPlacement='inside'
              label='Experience Price'
              aria-label='Experience Price'
              radius='sm'
              value={formData.price || 0}
              onValueChange={value => handleInputChange('price', value)}
            />
            <Input
              name='duration'
              label='Experience Duration'
              labelPlacement='inside'
              aria-label='Experience Duration'
              radius='sm'
              description='Ex: 2 hours, Half day, Full day'
              value={formData.duration || ''}
              onValueChange={value => handleInputChange('duration', value)}
            />
            <Input
              name='category'
              label='Experience Category'
              labelPlacement='inside'
              aria-label='Experience Category'
              radius='sm'
              description='Ex: Adventure, Relaxation, Cultural'
              value={formData.category || ''}
              onValueChange={value => handleInputChange('category', value)}
            />
            <Select
              name='difficulty'
              label='Difficulty Level'
              labelPlacement='inside'
              aria-label='Difficulty Level'
              radius='sm'
              selectedKeys={formData.difficulty ? [formData.difficulty] : []}
              onSelectionChange={keys => {
                const selectedKey = Array.from(keys)[0] as string;
                handleInputChange('difficulty', selectedKey);
              }}
            >
              <SelectItem key='Easy'>Easy</SelectItem>
              <SelectItem key='Moderate'>Moderate</SelectItem>
              <SelectItem key='Challenging'>Challenging</SelectItem>
            </Select>
            <Input
              name='tags'
              label='Tags (comma-separated)'
              labelPlacement='inside'
              aria-label='Experience Tags'
              radius='sm'
              value={formData.tags || ''}
              onValueChange={value => handleInputChange('tags', value)}
            />
            <Select
              name='seasonalAvailability'
              label='Seasonal Availability'
              labelPlacement='inside'
              aria-label='Seasonal Availability'
              radius='sm'
              selectionMode='multiple'
              selectedKeys={new Set(formData.seasonalAvailability ?? [])}
              onSelectionChange={keys => {
                const selectedKeys = Array.from(keys) as string[];
                handleInputChange('seasonalAvailability', selectedKeys);
              }}
            >
              <SelectItem key='All seasons'>All seasons</SelectItem>
              <SelectItem key='Spring'>Spring</SelectItem>
              <SelectItem key='Summer'>Summer</SelectItem>
              <SelectItem key='Fall'>Fall</SelectItem>
              <SelectItem key='Winter'>Winter</SelectItem>
            </Select>
            <Input
              name='location'
              label='Experience Location'
              labelPlacement='inside'
              aria-label='Experience Location'
              radius='sm'
              value={formData.location || ''}
              onValueChange={value => handleInputChange('location', value)}
            />
          </Container>
        </AccordionItem>
        <AccordionItem
          key={keys[1]}
          aria-label='Media & Visuals'
          title='Media & Visuals'
        >
          <Container>
            <Input
              name='imageUrl'
              label='Experience Image URL'
              labelPlacement='inside'
              aria-label='Experience Image URL'
              radius='sm'
              value={formData.imageUrl || ''}
              onValueChange={value => handleInputChange('imageUrl', value)}
            />
            <Input
              name='imageGallery'
              label='Image Gallery URL (comma-separated)'
              labelPlacement='inside'
              aria-label='Image Gallery URLs'
              radius='sm'
              value={formData.imageGallery || ''}
              onValueChange={value => handleInputChange('imageGallery', value)}
            />
          </Container>
        </AccordionItem>
        <AccordionItem
          key={keys[2]}
          aria-label='Descriptions'
          title='Descriptions'
        >
          <Container>
            <Textarea
              name='shortDescription'
              label='Short Description'
              labelPlacement='inside'
              aria-label='Short Description'
              radius='sm'
              value={formData.shortDescription || ''}
              onValueChange={value =>
                handleInputChange('shortDescription', value)
              }
            />
            <Textarea
              name='longDescription'
              label='Long Description'
              labelPlacement='inside'
              aria-label='Long Description'
              radius='sm'
              value={formData.longDescription || ''}
              onValueChange={value =>
                handleInputChange('longDescription', value)
              }
            />
            <Input
              name='highlights'
              label='Experience Highlights (comma-separated)'
              labelPlacement='inside'
              aria-label='Experience Highlights'
              radius='sm'
              value={formData.highlights || ''}
              onValueChange={value => handleInputChange('highlights', value)}
            />
          </Container>
        </AccordionItem>
        <AccordionItem
          key={keys[3]}
          aria-label='Experience Details'
          title='Experience Details'
        >
          <Container>
            <Input
              name='includes'
              label='Experience Includes (comma-separated)'
              labelPlacement='inside'
              aria-label='What the experience includes'
              radius='sm'
              description='Ex: Binoculars, Sunscreen, Notebook'
              value={formData.includes || ''}
              onValueChange={value => handleInputChange('includes', value)}
            />
            <Input
              name='whatToBring'
              label='What to bring (comma-separated)'
              labelPlacement='inside'
              aria-label='What participants should bring'
              radius='sm'
              description='Ex: Sunscreen, Water Bottle, Hat'
              value={formData.whatToBring || ''}
              onValueChange={value => handleInputChange('whatToBring', value)}
            />

            <Input
              name='requirements'
              label='Requirements (comma-separated)'
              labelPlacement='inside'
              aria-label='General Requirements'
              radius='sm'
              description='Ex: No pets, Must be 18+, Ability to swim'
              value={formData.requirements || ''}
              onValueChange={value => handleInputChange('requirements', value)}
            />
            <Input
              name='availableTimes'
              label='Experience Available times (comma-separated)'
              labelPlacement='inside'
              aria-label='Available Times'
              radius='sm'
              description='Ex: Weekends, Weekdays, Mornings, Afternoons'
              value={formData.availableTimes || ''}
              onValueChange={value =>
                handleInputChange('availableTimes', value)
              }
            />
          </Container>
        </AccordionItem>
        <AccordionItem
          key={keys[4]}
          aria-label='Booking & Policies'
          title='Booking & Policies'
        >
          <Container>
            <Input
              name='callToAction'
              label='Experience call to action text'
              labelPlacement='inside'
              aria-label='Call to Action Text'
              radius='sm'
              value={formData.callToAction || ''}
              onValueChange={value => handleInputChange('callToAction', value)}
            />
            <Input
              name='cancellationPolicy'
              label='Cancellation Policy'
              labelPlacement='inside'
              aria-label='Cancellation Policy'
              radius='sm'
              value={formData.cancellationPolicy || ''}
              onValueChange={value =>
                handleInputChange('cancellationPolicy', value)
              }
            />
            <NumberInput
              name='maxParticipants'
              label='Max Participants'
              labelPlacement='inside'
              aria-label='Maximum Number of Participants'
              min={1}
              radius='sm'
              value={formData.maxParticipants || 1}
              onValueChange={value =>
                handleInputChange('maxParticipants', value)
              }
            />
            <NumberInput
              name='minimumAge'
              label='Minimum Age'
              labelPlacement='inside'
              aria-label='Minimum Age Requirement'
              min={0}
              radius='sm'
              value={formData.minimumAge || 0}
              onValueChange={value => handleInputChange('minimumAge', value)}
            />
            <div className='md:col-span-2'>
              <Checkbox
                name='isPopular'
                isSelected={formData.isPopular || false}
                onValueChange={value => handleInputChange('isPopular', value)}
              >
                Mark as popular
              </Checkbox>
            </div>
          </Container>
        </AccordionItem>
      </Accordion>
    </Form>
  );
}
