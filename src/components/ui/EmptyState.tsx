import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-100 dark:bg-surface-800 text-surface-400 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-surface-900 dark:text-surface-100 mb-1">
        {title}
      </h3>
      <p className="text-sm text-surface-500 max-w-sm mb-4">
        {description}
      </p>
      {action}
    </div>
  );
}
