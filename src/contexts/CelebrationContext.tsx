import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, Sparkles, Coins, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/money';

interface CelebrationContextType {
  triggerNominaCelebration: (amountCents?: number) => void;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(undefined);

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [showCelebration, setShowCelebration] = useState(false);
  const [nominaAmount, setNominaAmount] = useState<number | null>(null);

  const triggerNominaCelebration = useCallback((amountCents?: number) => {
    setNominaAmount(amountCents ?? null);
    setShowCelebration(true);
  }, []);

  const closeCelebration = useCallback(() => {
    setShowCelebration(false);
  }, []);

  return (
    <CelebrationContext.Provider value={{ triggerNominaCelebration }}>
      {children}

      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md bg-gradient-to-b from-surface-900 to-black text-white border-2 border-amber-400 rounded-3xl p-6 shadow-2xl text-center overflow-hidden animate-scaleIn">
            {/* Background glowing sparkles */}
            <div className="absolute -top-12 -left-12 w-36 h-36 bg-amber-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={closeCelebration}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
              <span>Día de cobro · ¡Ha entrado la nómina!</span>
            </div>

            {/* Donald Duck GIF */}
            <div className="my-3 rounded-2xl overflow-hidden border border-amber-400/40 shadow-inner bg-black flex items-center justify-center max-h-56">
              <img
                src="/donald-money.gif"
                alt="Pato Donald tirando dinero y nadando en billetes"
                className="w-full h-full object-cover max-h-56"
                onError={(e) => {
                  // Fallback to Giphy direct link if needed
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('giphy.gif')) {
                    target.src = 'https://media.giphy.com/media/gQdejV5BBChHi/giphy.gif';
                  }
                }}
              />
            </div>

            {/* Amount display */}
            {nominaAmount !== null && nominaAmount > 0 && (
              <div className="my-3 p-3 bg-white/10 border border-emerald-400/30 rounded-2xl">
                <span className="text-[11px] text-emerald-300 font-semibold uppercase tracking-wider block">
                  Ingreso registrado en Banc Sabadell
                </span>
                <p className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums mt-0.5">
                  +{formatCurrency(nominaAmount)}
                </p>
              </div>
            )}

            {/* Title & subtitle */}
            <h2 className="text-2xl font-black text-amber-300 tracking-tight flex items-center justify-center gap-2">
              <Coins className="h-6 w-6 text-amber-400 animate-bounce" />
              <span>¡¡A COBRAR!!</span>
              <Coins className="h-6 w-6 text-amber-400 animate-bounce" />
            </h2>
            <p className="text-xs text-surface-300 mt-1 max-w-xs mx-auto">
              ¡Lluvia de billetes! La tesorería y la liquidez se han actualizado automáticamente.
            </p>

            {/* Action button */}
            <div className="mt-5">
              <button
                onClick={closeCelebration}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-black font-extrabold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <TrendingUp className="h-4 w-4" />
                <span>¡A gestionar con cabeza! 💸</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  );
}

export function useCelebration() {
  const context = useContext(CelebrationContext);
  if (!context) {
    throw new Error('useCelebration must be used within a CelebrationProvider');
  }
  return context;
}
