import { title } from '@/components/primitives';

interface PageHeaderProps {
  title: string;
  titleAccent?: string;
  subtitle?: string;
  centered?: boolean;
  className?: string;
}

export function PageHeader({
  title: pageTitle,
  titleAccent,
  subtitle: pageSubtitle,
  centered = true,
  className = '',
}: PageHeaderProps) {
  const subtitleClassName = `w-full my-2 mt-4 text-lg lg:text-xl text-default-600 block ${centered ? 'max-w-2xl mx-auto' : 'max-w-full'}`;

  return (
    <section className={`${centered ? 'text-center' : ''} ${className}`}>
      <h1 className={title({ size: 'lg' })}>
        {pageTitle}
        {titleAccent && (
          <>
            {' '}
            <span className={title({ color: 'green', size: 'lg' })}>
              {titleAccent}
            </span>
          </>
        )}
      </h1>
      {pageSubtitle && <p className={subtitleClassName}>{pageSubtitle}</p>}
    </section>
  );
}
