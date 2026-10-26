import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  subtitle?: string;
}

export function Logo({ size = 'md', showText = true, className = '', subtitle }: LogoProps) {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm font-bold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-black',
  };

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Premium SVG Vector Icon */}
      <div
        className={`${iconSizes[size]} relative rounded-xl bg-gradient-to-br from-[#107c41] via-[#0d6836] to-[#084222] p-1.5 shadow-md shadow-emerald-950/20 flex items-center justify-center shrink-0 border border-emerald-400/30 overflow-hidden group`}
      >
        {/* Subtle shine effect */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-60 pointer-events-none" />

        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-white drop-shadow-sm"
        >
          {/* Spreadsheet table grid outline */}
          <rect
            x="3"
            y="4"
            width="26"
            height="24"
            rx="4"
            stroke="currentColor"
            strokeWidth="2"
            fill="rgba(255, 255, 255, 0.08)"
          />

          {/* Header row divider */}
          <line x1="3" y1="12" x2="29" y2="12" stroke="currentColor" strokeWidth="2" />

          {/* Column divider */}
          <line x1="13" y1="12" x2="13" y2="28" stroke="currentColor" strokeWidth="1.7" strokeDasharray="1 1" />

          {/* Growth trend curve / bar charts */}
          <path
            d="M7 23L11 19L16 21L24 14"
            stroke="#FDE047"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Golden currency dot / target */}
          <circle cx="24" cy="14" r="2.5" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1" />

          {/* Header icons */}
          <rect x="7" y="7" width="5" height="2" rx="1" fill="#86EFAC" />
          <rect x="15" y="7" width="10" height="2" rx="1" fill="#FFFFFF" fillOpacity="0.8" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <span
            className={`tracking-tight text-surface-900 dark:text-surface-100 font-bold leading-tight ${textSizes[size]}`}
          >
            Personal Treasury
          </span>
          <span className="text-[10px] text-surface-500 dark:text-surface-400 font-medium tracking-wide uppercase truncate">
            {subtitle || 'Tesorería & Excel Anual'}
          </span>
        </div>
      )}
    </div>
  );
}
