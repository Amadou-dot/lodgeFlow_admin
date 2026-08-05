import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button } from '@heroui/button';
import { Form } from '@heroui/form';
import { useState } from 'react';
import {
  BasicInformationSection,
  BookingPoliciesSection,
  DescriptionsSection,
  ExperienceDetailsSection,
  FormActions,
  MediaVisualsSection,
  type EditExperienceFormProps,
} from './EditExperienceForm/';
import { Experience } from '@/types';

export default function EditExperienceForm({
  experience,
  onSave,
  onCancel,
  isLoading = false,
}: EditExperienceFormProps) {
  const [editedItem, setEditedItem] = useState(experience);
  const [isExpanded, setIsExpanded] = useState<Set<string>>(new Set());

  const keys = ['1', '2', '3', '4', '5'];
  const expandAll = () => setIsExpanded(new Set(keys));
  const collapseAll = () => setIsExpanded(new Set());

  const handleInputChange = (
    field: keyof typeof experience,
    value: Experience[keyof Experience]
  ) => {
    setEditedItem(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(editedItem);
  };

  return (
    <Form className='flex flex-col gap-4'>
      <div className='w-full flex justify-end'>
        <Button variant='light' size='sm' color='primary' onPress={collapseAll}>
          Collapse all
        </Button>
        <Button variant='light' size='sm' color='primary' onPress={expandAll}>
          Expand all
        </Button>
      </div>

      <Accordion
        aria-label='Edit Experience Form'
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
          <BasicInformationSection
            editedItem={editedItem}
            onInputChange={handleInputChange}
          />
        </AccordionItem>

        <AccordionItem
          key={keys[1]}
          aria-label='Media & Visuals'
          title='Media & Visuals'
        >
          <MediaVisualsSection
            editedItem={editedItem}
            onInputChange={handleInputChange}
          />
        </AccordionItem>

        <AccordionItem
          key={keys[2]}
          aria-label='Descriptions'
          title='Descriptions'
        >
          <DescriptionsSection
            editedItem={editedItem}
            onInputChange={handleInputChange}
          />
        </AccordionItem>

        <AccordionItem
          key={keys[3]}
          aria-label='Experience Details'
          title='Experience Details'
        >
          <ExperienceDetailsSection
            editedItem={editedItem}
            onInputChange={handleInputChange}
          />
        </AccordionItem>

        <AccordionItem
          key={keys[4]}
          aria-label='Booking & Policies'
          title='Booking & Policies'
        >
          <BookingPoliciesSection
            editedItem={editedItem}
            onInputChange={handleInputChange}
          />
        </AccordionItem>
      </Accordion>

      <FormActions
        onCancel={onCancel}
        onSave={handleSave}
        isLoading={isLoading}
      />
    </Form>
  );
}
