import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddExperienceForm from '@/components/AddExperienceForm';
import type { FormData, FormProps } from '@/components/AddExperienceForm/types';

const emptyForm: FormData = {
  name: '',
  title: '',
  description: '',
  category: '',
  duration: '',
  price: 0,
  capacity: 0,
  location: '',
};

describe('AddExperienceForm', () => {
  const mockSetFormData = jest.fn<void, Parameters<FormProps['setFormData']>>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all accordion sections', () => {
    render(
      <AddExperienceForm formData={emptyForm} setFormData={mockSetFormData} />
    );

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Media & Visuals')).toBeInTheDocument();
    expect(screen.getByText('Descriptions')).toBeInTheDocument();
    expect(screen.getByText('Experience Details')).toBeInTheDocument();
    expect(screen.getByText('Booking & Policies')).toBeInTheDocument();
  });

  it('renders expand/collapse controls', () => {
    render(
      <AddExperienceForm formData={emptyForm} setFormData={mockSetFormData} />
    );

    expect(screen.getByText('Expand all')).toBeInTheDocument();
    expect(screen.getByText('Collapse all')).toBeInTheDocument();
  });

  it('shows the Basic Information fields expanded by default', () => {
    render(
      <AddExperienceForm formData={emptyForm} setFormData={mockSetFormData} />
    );

    expect(screen.getByLabelText('Experience Title')).toBeInTheDocument();
    // HeroUI Select renders a hidden native <select> plus a visible trigger,
    // both carrying the aria-label
    expect(screen.getAllByLabelText('Difficulty Level').length).toBeGreaterThan(
      0
    );
    expect(
      screen.getAllByLabelText('Seasonal Availability').length
    ).toBeGreaterThan(0);
  });

  it('calls setFormData with an updater when a text input changes', () => {
    render(
      <AddExperienceForm formData={emptyForm} setFormData={mockSetFormData} />
    );

    fireEvent.change(screen.getByLabelText('Experience Title'), {
      target: { value: 'Test Experience' },
    });

    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    const [updater] = mockSetFormData.mock.calls[0];
    if (typeof updater !== 'function') {
      throw new Error('Expected a form data updater');
    }

    const originalForm = { ...emptyForm, price: 50 };
    const previousForm = { ...originalForm };
    const updatedForm = updater(previousForm);

    expect(updatedForm).toEqual({
      ...originalForm,
      title: 'Test Experience',
    });
    expect(previousForm).toEqual(originalForm);
  });

  it('displays provided form data in the default-expanded section', () => {
    render(
      <AddExperienceForm
        formData={{
          ...emptyForm,
          title: 'Mountain Hiking',
          price: 100,
          category: 'Adventure',
        }}
        setFormData={mockSetFormData}
      />
    );

    expect(screen.getByDisplayValue('Mountain Hiking')).toBeInTheDocument();
    // NumberInput renders a visible and a hidden input with the same value
    expect(screen.getAllByDisplayValue('100').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Adventure')).toBeInTheDocument();
  });

  it('renders the difficulty options', () => {
    render(
      <AddExperienceForm formData={emptyForm} setFormData={mockSetFormData} />
    );

    const nativeSelect = screen
      .getAllByLabelText('Difficulty Level')
      .find(el => el.tagName === 'SELECT');

    expect(nativeSelect).toBeDefined();
    const options = Array.from(nativeSelect!.querySelectorAll('option')).map(
      o => o.textContent
    );
    expect(options).toEqual(
      expect.arrayContaining(['Easy', 'Moderate', 'Challenging'])
    );
  });
});
