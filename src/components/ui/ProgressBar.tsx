interface ProgressBarProps {
  value: number; // 0-100
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'brand' | 'success' | 'warning' | 'danger' | 'savings';
  showLabel?: boolean;
  label?: string;
}

const sizeClasses = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const variantClasses = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-400',
  danger: 'bg-danger-500',
  savings: 'bg-savings-500',
};

function getAutoVariant(value: number): 'success' | 'warning' | 'danger' {
  if (value > 100) return 'danger';
  if (value >= 90) return 'danger';
  if (value >= 75) return 'warning';
  return 'success';
}

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  variant,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const displayPercentage = (value / max) * 100;
  const autoVariant = variant ?? getAutoVariant(displayPercentage);

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-xs font-medium text-surface-600 dark:text-surface-400">
              {label}
            </span>
          )}
          {showLabel && (
            <span className="text-xs font-mono text-surface-500 tabular-nums">
              {displayPercentage.toFixed(1)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`
          w-full rounded-full bg-surface-100 dark:bg-surface-800 overflow-hidden
          ${sizeClasses[size]}
        `}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-500 ease-out
            ${variantClasses[autoVariant]}
          `}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
