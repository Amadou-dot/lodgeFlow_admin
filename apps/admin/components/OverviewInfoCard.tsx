interface Props {
  title: string;
  description: string;
  variant?: 'blue' | 'green' | 'purple' | 'orange';
}

export default function OverviewInfoCard({
  title,
  description,
  variant = 'blue',
}: Props) {
  const colorClasses = {
    blue: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/40 border-blue-200 dark:border-blue-700/60 text-blue-900 dark:text-blue-100',
    green:
      'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/40 border-green-200 dark:border-green-700/60 text-green-900 dark:text-green-100',
    purple:
      'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/40 border-purple-200 dark:border-purple-700/60 text-purple-900 dark:text-purple-100',
    orange:
      'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/40 border-orange-200 dark:border-orange-700/60 text-orange-900 dark:text-orange-100',
  };

  const descriptionClasses = {
    blue: 'text-blue-600 dark:text-blue-300',
    green: 'text-green-600 dark:text-green-300',
    purple: 'text-purple-600 dark:text-purple-300',
    orange: 'text-orange-600 dark:text-orange-300',
  };

  return (
    <div
      className={`flex flex-col text-center p-4 rounded-lg flex-1 border ${colorClasses[variant]} h-24 justify-center`}
    >
      <p className='text-xs font-medium uppercase tracking-wide opacity-80'>
        {title}
      </p>
      <p className={`text-xl font-bold ${descriptionClasses[variant]}`}>
        {description}
      </p>
    </div>
  );
}
