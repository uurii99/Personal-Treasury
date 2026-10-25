interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'savings';
  size?: 'sm' | 'md';
}

const variantClasses = {
  default: 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300',
  success: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400',
  warning: 'bg-warning-50 text-warning-500 dark:bg-warning-100/10 dark:text-warning-400',
  danger: 'bg-danger-50 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400',
  info: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400',
  savings: 'bg-savings-50 text-savings-600 dark:bg-savings-900/30 dark:text-savings-400',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
};

export function Badge({ children, variant = 'default', size = 'md' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full
        ${variantClasses[variant]}
        ${sizeClasses[size]}
      `}
    >
      {children}
    </span>
  );
}
