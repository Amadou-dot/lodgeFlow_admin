import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import type { FormData } from './types';
import { countries } from './types';

interface BasicInformationSectionProps {
  formData: FormData;
  errors: Record<string, string>;
  onInputChange: (field: string, value: string) => void;
  isEditing?: boolean; // Add prop to hide password field when editing
}

export default function BasicInformationSection({
  formData,
  errors,
  onInputChange,
  isEditing = false,
}: BasicInformationSectionProps) {
  return (
    <div className='space-y-4 w-full'>
      <h3 className='text-lg font-semibold'>Basic Information</h3>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <Input
          label='First Name'
          placeholder='Enter first name'
          value={formData.firstName}
          onValueChange={value => onInputChange('firstName', value)}
          isInvalid={!!errors.firstName}
          errorMessage={errors.firstName}
          isRequired
          name='firstName'
        />
        <Input
          label='Last Name'
          placeholder='Enter last name'
          value={formData.lastName}
          onValueChange={value => onInputChange('lastName', value)}
          isInvalid={!!errors.lastName}
          errorMessage={errors.lastName}
          isRequired
          name='lastName'
        />
        <Input
          label='Email'
          placeholder='Enter email address'
          type='email'
          value={formData.email}
          onValueChange={value => onInputChange('email', value)}
          isInvalid={!!errors.email}
          errorMessage={errors.email}
          isRequired
          name='email'
        />
        <Input
          label='Phone'
          placeholder='Enter phone number'
          value={formData.phone}
          onValueChange={value => onInputChange('phone', value)}
          name='phone'
        />
        {!isEditing && (
          <Input
            label='Password'
            placeholder='Enter password (min 8 characters)'
            type='password'
            value={formData.password}
            onValueChange={value => onInputChange('password', value)}
            isInvalid={!!errors.password}
            errorMessage={errors.password}
            isRequired
            name='password'
            description='Minimum 8 characters required'
          />
        )}
        <Select
          label='Nationality'
          placeholder='Select nationality'
          selectedKeys={formData.nationality ? [formData.nationality] : []}
          onSelectionChange={keys => {
            const selected = Array.from(keys)[0] as string;
            onInputChange('nationality', selected || '');
          }}
          isInvalid={!!errors.nationality}
          errorMessage={errors.nationality}
          isRequired
          name='nationality'
        >
          {countries.map(country => (
            <SelectItem key={country}>{country}</SelectItem>
          ))}
        </Select>
        <Input
          label='National ID'
          placeholder='Enter ID/passport number'
          value={formData.nationalId}
          onValueChange={value => onInputChange('nationalId', value)}
          isInvalid={!!errors.nationalId}
          errorMessage={errors.nationalId}
          isRequired
          name='nationalId'
        />
      </div>
    </div>
  );
}
