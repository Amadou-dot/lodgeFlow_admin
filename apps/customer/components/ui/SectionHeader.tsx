import { title, subtitle } from '@/components/primitives';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function SectionHeader({
  title: sectionTitle,
  subtitle: sectionSubtitle,
  centered = true,
  className = '',
  size = 'md',
}: SectionHeaderProps) {
  return (
    <div className={`${centered ? 'text-center' : ''} ${className}`}>
      <h2 className={title({ size })}>{sectionTitle}</h2>
      {sectionSubtitle && (
        <p className={subtitle({ class: 'mt-4' })}>{sectionSubtitle}</p>
      )}
    </div>
  );
}
