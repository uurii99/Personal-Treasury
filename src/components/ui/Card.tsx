import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        bg-white dark:bg-surface-900
        border border-surface-200 dark:border-surface-800
        rounded-xl shadow-card
        ${paddingClasses[padding]}
        ${hover ? 'transition-all duration-200 hover:shadow-card-hover hover:border-surface-300 dark:hover:border-surface-700 cursor-pointer' : ''}
        ${onClick ? 'text-left w-full' : ''}
        ${className}
      `.trim()}
    >
      {children}
    </Component>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-surface-900 dark:text-surface-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-surface-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
