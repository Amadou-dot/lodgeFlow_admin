import { fireEvent, render, screen, within } from '@testing-library/react';
import { lakesideHavenPhotos } from '@lodgeflow/database/cabin-photos';
import CabinGallery from '@/components/CabinGallery';

it('keeps the fullscreen viewer inside the gallery when navigating from the dock back to the cover', () => {
  const photos = lakesideHavenPhotos.map(photo => photo.src);
  const cover = lakesideHavenPhotos[0];
  const dock = lakesideHavenPhotos[7];
  render(<CabinGallery images={photos} />);

  const gallery = within(
    screen.getByRole('region', { name: 'Cabin photo gallery' })
  );
  const dockButton = gallery.getByRole('button', { name: dock.alt });
  fireEvent.click(dockButton);
  expect(dockButton).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(
    gallery.getByRole('button', { name: 'View image fullscreen' })
  );
  expect(gallery.getByText('8 of 8')).toBeVisible();

  fireEvent.keyDown(window, { key: 'ArrowRight' });
  expect(gallery.getByText('1 of 8')).toBeVisible();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(gallery.queryByRole('button', { name: 'Close lightbox' })).toBeNull();
  expect(gallery.getByRole('img', { name: cover.alt })).toBeVisible();
});
