import { render, screen } from '@testing-library/react';
import Breadcrumb, { BreadcrumbItemType } from '@/components/Breadcrumb';

describe('Breadcrumb Component', () => {
  it('renders breadcrumb items correctly', () => {
    const items: BreadcrumbItemType[] = [
      { label: 'Home', href: '/' },
      { label: 'Cabins', href: '/cabins' },
      { label: 'Mountain View Cabin' },
    ];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Cabins')).toBeInTheDocument();
    expect(screen.getByText('Mountain View Cabin')).toBeInTheDocument();
  });

  it('renders links for non-current items', () => {
    const items: BreadcrumbItemType[] = [
      { label: 'Home', href: '/' },
      { label: 'Cabins', href: '/cabins' },
      { label: 'Current Page' },
    ];

    render(<Breadcrumb items={items} />);

    const homeLink = screen.getByText('Home').closest('a');
    const cabinsLink = screen.getByText('Cabins').closest('a');

    expect(homeLink).toHaveAttribute('href', '/');
    expect(cabinsLink).toHaveAttribute('href', '/cabins');
  });

  it('renders last item as span without link', () => {
    const items: BreadcrumbItemType[] = [
      { label: 'Home', href: '/' },
      { label: 'Current Page' },
    ];

    render(<Breadcrumb items={items} />);

    const currentItem = screen.getByText('Current Page');
    expect(currentItem.closest('a')).toBeNull();
    expect(currentItem.tagName).toBe('SPAN');
  });

  it('applies font-semibold class to the last item', () => {
    const items: BreadcrumbItemType[] = [
      { label: 'Home', href: '/' },
      { label: 'Current Page' },
    ];

    render(<Breadcrumb items={items} />);

    const currentItem = screen.getByText('Current Page');
    const breadcrumbItem = currentItem.closest('[class*="font-semibold"]');
    expect(breadcrumbItem).toBeInTheDocument();
  });

  it('handles single item breadcrumb', () => {
    const items: BreadcrumbItemType[] = [{ label: 'Home' }];

    render(<Breadcrumb items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Home').closest('a')).toBeNull();
  });

  it('renders all items in correct order', () => {
    const items: BreadcrumbItemType[] = [
      { label: 'First', href: '/first' },
      { label: 'Second', href: '/second' },
      { label: 'Third', href: '/third' },
      { label: 'Fourth' },
    ];

    render(<Breadcrumb items={items} />);

    const breadcrumbItems = screen
      .getAllByRole('listitem')
      .map(item => item.textContent);

    expect(breadcrumbItems).toEqual(['First', 'Second', 'Third', 'Fourth']);
  });
});
