import React from 'react';
import { Building2, Banknote } from 'lucide-react';

interface BankLogoProps {
  bankName: string;
  isCash?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BankLogo({ bankName, isCash, size = 'md', className = '' }: BankLogoProps) {
  const norm = (bankName || '').trim().toLowerCase();

  const dimensions = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  }[size];

  // 1. Cash / Efectivo
  if (isCash || norm.includes('efectivo') || norm.includes('efectiu') || norm.includes('cash')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0 ${className}`}
        title="Efectivo en mano"
      >
        <Banknote className={size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />
      </div>
    );
  }

  // 2. Banc Sabadell
  if (norm.includes('sabadell') || norm.includes('banc sabadell') || norm.includes('banco sabadell')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#005697] text-white flex items-center justify-center shadow-sm shrink-0 font-bold overflow-hidden p-1 ${className}`}
        title="Banc Sabadell"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current" aria-label="Banc Sabadell">
          <text
            x="50%"
            y="54%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="52"
            letterSpacing="-3"
          >
            BS
          </text>
        </svg>
      </div>
    );
  }

  // 3. Revolut
  if (norm.includes('revolut')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#191C1F] text-white flex items-center justify-center shadow-sm shrink-0 font-bold overflow-hidden p-1 ${className}`}
        title="Revolut"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current" aria-label="Revolut">
          <path d="M26 18h28c14 0 24 9 24 22 0 10-6 18-16 21l18 21H64L48 62H38v20H26V18zm12 32h14c7 0 12-4 12-10s-5-10-12-10H38v20z" />
        </svg>
      </div>
    );
  }

  // 4. Trade Republic
  if (norm.includes('trade republic') || norm.includes('trade')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#121212] text-white flex items-center justify-center shadow-sm shrink-0 font-bold overflow-hidden p-1.5 ${className}`}
        title="Trade Republic"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current" aria-label="Trade Republic">
          {/* Minimalist geometric double corner lines of Trade Republic */}
          <path d="M18 24h64v10H30v42H18V24z" />
          <path d="M44 48h38v10H56v18H44V48z" />
        </svg>
      </div>
    );
  }

  // 5. MyInversor
  if (norm.includes('myinversor') || norm.includes('my inversor')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#E30613] text-white flex items-center justify-center shadow-sm shrink-0 font-extrabold overflow-hidden p-1 ${className}`}
        title="MyInversor"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current" aria-label="MyInversor">
          <text
            x="50%"
            y="54%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            fontWeight="900"
            fontSize="48"
            letterSpacing="-2"
          >
            my
          </text>
        </svg>
      </div>
    );
  }

  // 6. CaixaBank / La Caixa
  if (norm.includes('caixa') || norm.includes('caixabank') || norm.includes('la caixa')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#000000] text-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden p-1.5 ${className}`}
        title="CaixaBank"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" aria-label="CaixaBank">
          {/* Miró Star inspired icon */}
          <circle cx="50" cy="50" r="18" fill="#FFCC00" />
          <path d="M50 15 L58 40 L85 45 L62 60 L68 85 L50 68 L32 85 L38 60 L15 45 L42 40 Z" fill="#0055A5" opacity="0.9" />
          <circle cx="68" cy="30" r="10" fill="#E4002B" />
        </svg>
      </div>
    );
  }

  // 7. BBVA
  if (norm.includes('bbva')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#004481] text-white flex items-center justify-center shadow-sm shrink-0 font-bold overflow-hidden p-1 ${className}`}
        title="BBVA"
      >
        <span className="text-[10px] tracking-tighter font-black">BBVA</span>
      </div>
    );
  }

  // 8. Santander
  if (norm.includes('santander') || norm.includes('banco santander')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#EC0000] text-white flex items-center justify-center shadow-sm shrink-0 overflow-hidden p-1.5 ${className}`}
        title="Banco Santander"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full fill-white" aria-label="Santander">
          <path d="M50 12c-4 12-14 20-14 32 0 14 12 24 24 24 1 0 3 0 4-1-2-5-3-11-3-17 0-9 4-17 9-24-4 2-8 5-11 9 1-6 4-13 8-19-4 2-8 4-11 8 0-4 1-8 3-12-6 3-10 8-14 14 3-5 7-9 12-12-3 2-6 5-8 8 2-3 4-6 6-9z" />
        </svg>
      </div>
    );
  }

  // 9. N26
  if (norm.includes('n26')) {
    return (
      <div
        className={`${dimensions} rounded-xl bg-[#36A18B] text-white flex items-center justify-center shadow-sm shrink-0 font-black overflow-hidden ${className}`}
        title="N26"
      >
        <span className="text-[11px] font-bold">N26</span>
      </div>
    );
  }

  // 10. Fallback: stylized first letter or bank building
  return (
    <div
      className={`${dimensions} rounded-xl bg-surface-700 dark:bg-surface-800 text-white flex items-center justify-center shadow-sm shrink-0 font-bold ${className}`}
      title={bankName}
    >
      {bankName ? bankName.charAt(0).toUpperCase() : <Building2 className="w-4 h-4" />}
    </div>
  );
}
