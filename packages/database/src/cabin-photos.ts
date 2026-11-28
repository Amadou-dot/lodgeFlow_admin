const directory = '/cabin-photos/lakeside-haven';

export const lakesideHavenPhotos = [
  {
    src: `${directory}/exterior.webp`,
    alt: 'Lakeside Haven and its wooden dock on a pine-lined cove',
  },
  {
    src: `${directory}/great-room.webp`,
    alt: 'Fieldstone fireplace and lake-facing windows in the great room',
  },
  {
    src: `${directory}/kitchen-dining.webp`,
    alt: 'Oak dining table beside the sage-green kitchen',
  },
  {
    src: `${directory}/lake-bedroom.webp`,
    alt: 'Queen bedroom with a sage throw and a view of the lake',
  },
  {
    src: `${directory}/pine-bedroom.webp`,
    alt: 'Forest-facing queen bedroom with a rust quilt and reading chair',
  },
  {
    src: `${directory}/twin-bedroom.webp`,
    alt: 'Two twin beds with striped blankets under a pine-view window',
  },
  {
    src: `${directory}/bathroom.webp`,
    alt: 'Wood vanity and glass-enclosed stone-tile shower',
  },
  {
    src: `${directory}/private-dock.webp`,
    alt: 'View along the private dock with two kayaks on the rocky shore',
  },
] as const;

/** Only listed first-party paths are valid alternatives to external image URLs. */
export function findBundledCabinPhoto(src: string) {
  return lakesideHavenPhotos.find(photo => photo.src === src);
}
