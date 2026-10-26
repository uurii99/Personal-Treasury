import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center bg-surface-100 dark:bg-surface-800 rounded-lg p-0.5 border border-surface-200 dark:border-surface-700 select-none">
      <button
        type="button"
        onClick={() => setLanguage('es')}
        className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all ${
          language === 'es'
            ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
            : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
        }`}
        title="Cambiar a Español"
      >
        <span>🇪🇸</span>
        <span>ES</span>
      </button>

      <button
        type="button"
        onClick={() => setLanguage('ca')}
        className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[11px] sm:text-xs font-bold transition-all ${
          language === 'ca'
            ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
            : 'text-surface-500 hover:text-surface-800 dark:hover:text-surface-200'
        }`}
        title="Canviar a Català"
      >
        <span>CAT</span>
      </button>
    </div>
  );
}
