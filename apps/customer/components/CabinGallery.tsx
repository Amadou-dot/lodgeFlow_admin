'use client';

import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';

interface CabinGalleryProps {
  images: string[];
}

export default function CabinGallery({ images }: CabinGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [direction, setDirection] = useState(0);

  const hasMultiple = images && images.length > 1;

  const goTo = useCallback(
    (index: number) => {
      setDirection(index > activeIndex ? 1 : -1);
      setActiveIndex(index);
    },
    [activeIndex]
  );

  const goNext = useCallback(() => {
    if (!images?.length) return;
    setDirection(1);
    setActiveIndex(prev => (prev + 1) % images.length);
  }, [images?.length]);

  const goPrev = useCallback(() => {
    if (!images?.length) return;
    setDirection(-1);
    setActiveIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images?.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!lightboxOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, goNext, goPrev]);

  // Lock body scroll when lightbox open
  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [lightboxOpen]);

  if (!images || images.length === 0) return null;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <>
      {/* Main Gallery */}
      <div className='w-full'>
        {/* Hero Image */}
        <div
          aria-label='View image fullscreen'
          className='relative w-full overflow-hidden rounded-2xl bg-default-100 cursor-pointer group'
          role='button'
          style={{ aspectRatio: '16 / 9', maxHeight: '520px' }}
          tabIndex={0}
          onClick={() => setLightboxOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setLightboxOpen(true);
          }}
        >
          <AnimatePresence custom={direction} mode='popLayout'>
            <motion.div
              key={activeIndex}
              animate='center'
              className='absolute inset-0'
              custom={direction}
              exit='exit'
              initial='enter'
              transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              variants={slideVariants}
            >
              <Image
                alt={`Gallery image ${activeIndex + 1}`}
                className='object-cover'
                fill
                priority={activeIndex === 0}
                sizes='(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1100px'
                src={images[activeIndex]}
              />
            </motion.div>
          </AnimatePresence>

          {/* Gradient overlay at bottom for contrast */}
          <div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent pointer-events-none' />

          {/* Expand icon */}
          <div className='absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white rounded-xl p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
            <Expand size={18} />
          </div>

          {/* Image counter */}
          {hasMultiple && (
            <div className='absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm text-white text-sm font-medium rounded-lg px-3 py-1.5 tabular-nums'>
              {activeIndex + 1} / {images.length}
            </div>
          )}

          {/* Navigation arrows on hero */}
          {hasMultiple && (
            <>
              <button
                aria-label='Previous image'
                className='absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer'
                onClick={e => {
                  e.stopPropagation();
                  goPrev();
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                aria-label='Next image'
                className='absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 backdrop-blur-sm hover:bg-black/60 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer'
                onClick={e => {
                  e.stopPropagation();
                  goNext();
                }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Strip */}
        {hasMultiple && (
          <div className='mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide'>
            {images.map((src, idx) => (
              <button
                key={idx}
                aria-label={`View image ${idx + 1}`}
                style={{ width: '88px', height: '60px' }}
                className={`relative flex-none rounded-xl overflow-hidden transition-all duration-300 cursor-pointer ${
                  idx === activeIndex
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background opacity-100 scale-[1.02]'
                    : 'opacity-60 hover:opacity-90'
                }`}
                onClick={() => goTo(idx)}
              >
                <Image
                  alt={`Thumbnail ${idx + 1}`}
                  className='object-cover'
                  fill
                  sizes='88px'
                  src={src}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            animate={{ opacity: 1 }}
            className='fixed inset-0 z-50 flex items-center justify-center'
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Backdrop */}
            <div
              className='absolute inset-0 bg-black/90 backdrop-blur-md'
              onClick={() => setLightboxOpen(false)}
            />

            {/* Close button */}
            <button
              aria-label='Close lightbox'
              className='absolute top-5 right-5 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors duration-200 cursor-pointer'
              onClick={() => setLightboxOpen(false)}
            >
              <X size={22} />
            </button>

            {/* Image counter in lightbox */}
            {hasMultiple && (
              <div className='absolute top-6 left-1/2 -translate-x-1/2 z-10 text-white/80 text-sm font-medium tabular-nums'>
                {activeIndex + 1} of {images.length}
              </div>
            )}

            {/* Lightbox image */}
            <div className='relative w-[90vw] h-[80vh] max-w-6xl'>
              <AnimatePresence custom={direction} mode='popLayout'>
                <motion.div
                  key={activeIndex}
                  animate='center'
                  className='absolute inset-0'
                  custom={direction}
                  exit='exit'
                  initial='enter'
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  variants={slideVariants}
                >
                  <Image
                    alt={`Gallery image ${activeIndex + 1}`}
                    className='object-contain'
                    fill
                    sizes='90vw'
                    src={images[activeIndex]}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Lightbox navigation */}
            {hasMultiple && (
              <>
                <button
                  aria-label='Previous image'
                  className='absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors duration-200 cursor-pointer'
                  onClick={goPrev}
                >
                  <ChevronLeft size={28} />
                </button>
                <button
                  aria-label='Next image'
                  className='absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 text-white rounded-full p-3 transition-colors duration-200 cursor-pointer'
                  onClick={goNext}
                >
                  <ChevronRight size={28} />
                </button>
              </>
            )}

            {/* Lightbox thumbnails */}
            {hasMultiple && (
              <div className='absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2 bg-black/40 backdrop-blur-sm rounded-2xl p-2'>
                {images.map((src, idx) => (
                  <button
                    key={idx}
                    aria-label={`View image ${idx + 1}`}
                    style={{ width: '64px', height: '44px' }}
                    className={`relative flex-none rounded-lg overflow-hidden transition-all duration-300 cursor-pointer ${
                      idx === activeIndex
                        ? 'ring-2 ring-white opacity-100'
                        : 'opacity-50 hover:opacity-80'
                    }`}
                    onClick={() => goTo(idx)}
                  >
                    <Image
                      alt={`Thumbnail ${idx + 1}`}
                      className='object-cover'
                      fill
                      sizes='64px'
                      src={src}
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
