import { useState, useEffect } from 'react';
import { Percent, Check, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { validatePercentages } from '@/lib/money';

interface PercentageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function PercentageModal({ open, onOpenChange, onUpdated }: PercentageModalProps) {
  const { settings, updateSettings } = useAuth();
  const { success, error: showError } = useToast();

  const [fixed, setFixed] = useState(settings?.fixed_percentage ?? 40);
  const [leisure, setLeisure] = useState(settings?.leisure_percentage ?? 30);
  const [savings, setSavings] = useState(settings?.savings_percentage ?? 30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && settings) {
      setFixed(settings.fixed_percentage);
      setLeisure(settings.leisure_percentage);
      setSavings(settings.savings_percentage);
    }
  }, [open, settings]);

  const validation = validatePercentages(fixed, leisure, savings);
  const total = fixed + leisure + savings;

  const applyPreset = (f: number, l: number, s: number) => {
    setFixed(f);
    setLeisure(l);
    setSavings(s);
  };

  const handleSave = async () => {
    if (!validation.valid) {
      showError(validation.error ?? 'Los porcentajes deben sumar 100%');
      return;
    }

    setSaving(true);
    try {
      const { error } = await updateSettings({
        fixed_percentage: fixed,
        leisure_percentage: leisure,
        savings_percentage: savings,
      });

      if (error) {
        showError('Error al guardar los porcentajes');
      } else {
        success('Porcentajes actualizados', `Fijos: ${fixed}% · Ocio: ${leisure}% · Ahorro: ${savings}%`);
        onOpenChange(false);
        onUpdated?.();
      }
    } catch {
      showError('Error inesperado al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ajustar porcentajes de presupuesto"
      description="Define cómo se calculan los objetivos de cada tabla en tu Excel anual."
      size="md"
    >
      <div className="space-y-5">
        {/* Presets */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2 block">
            Plantillas rápidas
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyPreset(50, 30, 20)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                fixed === 50 && leisure === 30 && savings === 20
                  ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                  : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" /> Regla 50 / 30 / 20
                </span>
                {fixed === 50 && leisure === 30 && savings === 20 && (
                  <Check className="h-3.5 w-3.5 text-brand-600" />
                )}
              </div>
              <p className="text-[11px] text-surface-500">50% Fijos · 30% Ocio · 20% Ahorro</p>
            </button>

            <button
              type="button"
              onClick={() => applyPreset(40, 30, 30)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                fixed === 40 && leisure === 30 && savings === 30
                  ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300 ring-2 ring-brand-500/20'
                  : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-surface-900 dark:text-surface-100 flex items-center gap-1">
                  <Percent className="h-3 w-3 text-brand-500" /> Enfoque Ahorro
                </span>
                {fixed === 40 && leisure === 30 && savings === 30 && (
                  <Check className="h-3.5 w-3.5 text-brand-600" />
                )}
              </div>
              <p className="text-[11px] text-surface-500">40% Fijos · 30% Ocio · 30% Ahorro</p>
            </button>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-4 bg-surface-50 dark:bg-surface-800/40 p-4 rounded-xl border border-surface-200 dark:border-surface-800">
          {/* Gastos Fijos */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" /> Gastos Fijos
              </span>
              <span className="text-xs font-mono font-bold text-surface-900 dark:text-surface-100 tabular-nums">
                {fixed}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={fixed}
              onChange={(e) => setFixed(parseInt(e.target.value) || 0)}
              className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-slate-600"
            />
          </div>

          {/* Ocio y Variables */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Ocio y Variables
              </span>
              <span className="text-xs font-mono font-bold text-surface-900 dark:text-surface-100 tabular-nums">
                {leisure}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={leisure}
              onChange={(e) => setLeisure(parseInt(e.target.value) || 0)}
              className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          {/* Inversiones y Ahorro */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Inversiones y Ahorro
              </span>
              <span className="text-xs font-mono font-bold text-surface-900 dark:text-surface-100 tabular-nums">
                {savings}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={savings}
              onChange={(e) => setSavings(parseInt(e.target.value) || 0)}
              className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Sum preview */}
          <div
            className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
              validation.valid
                ? 'bg-success-50 border-success-200 text-success-700 dark:bg-success-900/20 dark:border-success-800/60 dark:text-success-400'
                : 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-900/20 dark:border-danger-800/60 dark:text-danger-400'
            }`}
          >
            <span className="font-medium">Total porcentajes asignados:</span>
            <span className="font-bold font-mono tabular-nums">{total}% / 100%</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving} disabled={!validation.valid}>
            Guardar porcentajes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
