import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AddExperienceForm from '@/components/AddExperienceForm';

describe('AddExperienceForm', () => {
  const mockSetFormData = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all accordion sections', () => {
    render(<AddExperienceForm formData={{}} setFormData={mockSetFormData} />);

    expect(screen.getByText('Basic Information')).toBeInTheDocument();
    expect(screen.getByText('Media & Visuals')).toBeInTheDocument();
    expect(screen.getByText('Descriptions')).toBeInTheDocument();
    expect(screen.getByText('Experience Details')).toBeInTheDocument();
    expect(screen.getByText('Booking & Policies')).toBeInTheDocument();
  });

  it('renders expand/collapse controls', () => {
    render(<AddExperienceForm formData={{}} setFormData={mockSetFormData} />);

    expect(screen.getByText('Expand all')).toBeInTheDocument();
    expect(screen.getByText('Collapse all')).toBeInTheDocument();
  });

  it('shows the Basic Information fields expanded by default', () => {
    render(<AddExperienceForm formData={{}} setFormData={mockSetFormData} />);

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
    render(<AddExperienceForm formData={{}} setFormData={mockSetFormData} />);

    fireEvent.change(screen.getByLabelText('Experience Title'), {
      target: { value: 'Test Experience' },
    });

    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    const updater = mockSetFormData.mock.calls[0][0];
    expect(updater({ price: 50 })).toEqual({
      price: 50,
      title: 'Test Experience',
    });
  });

  it('displays provided form data in the default-expanded section', () => {
    render(
      <AddExperienceForm
        formData={{
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
    render(<AddExperienceForm formData={{}} setFormData={mockSetFormData} />);

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
