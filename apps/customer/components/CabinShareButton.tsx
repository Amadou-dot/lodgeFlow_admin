'use client';

import { useState } from 'react';
import { Button } from '@heroui/button';
import { Tooltip } from '@heroui/tooltip';
import { Share2 } from 'lucide-react';

interface CabinShareButtonProps {
  cabinName: string;
}

export default function CabinShareButton({ cabinName }: CabinShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: cabinName,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled the share sheet — silently ignore
        return;
      }
      console.warn('Share failed:', err);
    }
  };

  return (
    <Tooltip
      content={copied ? 'Link copied to clipboard!' : 'Share this cabin'}
    >
      <Button
        aria-label={copied ? 'Link copied to clipboard' : 'Share this cabin'}
        startContent={<Share2 className='h-4 w-4' />}
        variant='flat'
        onPress={handleShare}
      >
        {copied ? 'Link Copied!' : 'Share'}
      </Button>
    </Tooltip>
  );
}
