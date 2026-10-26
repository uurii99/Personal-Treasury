import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Check, Sparkles, Percent, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, Input, Card } from '@/components/ui';
import { validatePercentages } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import type { BudgetSection } from '@/types';

// Categories matching TRESORERIA URI.xlsx exactly
const INITIAL_CATEGORIES: { name: string; section: BudgetSection }[] = [
  // 1. Gastos Fijos (40%)
  { name: 'GYM - FIJO', section: 'fixed' },
  { name: 'ASSEG. MOTO', section: 'fixed' },
  { name: 'ITV MOTO', section: 'fixed' },
  { name: 'REV./REPARACIONS MOTO', section: 'fixed' },
  { name: 'IMPOST CIRCULACIO MOTO', section: 'fixed' },
  { name: 'TRANSPORT PÚBLIC', section: 'fixed' },
  { name: 'BENZINA MOTO', section: 'fixed' },
  { name: 'CORTE DE PELO', section: 'fixed' },
  { name: 'OTROS', section: 'fixed' },

  // 2. Gastos Opcionales / Ocio (30%)
  { name: 'SALIDAS/VIAGES', section: 'leisure' },
  { name: 'ROPA', section: 'leisure' },
  { name: 'COMIDAS', section: 'leisure' },
  { name: 'DEPORTES', section: 'leisure' },
  { name: 'REGALS', section: 'leisure' },
  { name: 'PIEZAS MOTO', section: 'leisure' },
  { name: 'GASOLINA MOTO', section: 'leisure' },
  { name: 'HOTWHEELS', section: 'leisure' },

  // 3. Inversiones y Ahorro (30%)
  { name: 'INVERSIÓ', section: 'savings' },
  { name: 'FONS EMERGENCIA', section: 'savings' },
];

export function OnboardingPage() {
  const { updateProfile, updateSettings, completeOnboarding, user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState('');
  // Default to 40/30/30 as in TRESORERIA URI.xlsx
  const [fixedPercentage, setFixedPercentage] = useState(40);
  const [leisurePercentage, setLeisurePercentage] = useState(30);
  const [savingsPercentage, setSavingsPercentage] = useState(30);

  const percentageValidation = validatePercentages(
    fixedPercentage,
    leisurePercentage,
    savingsPercentage
  );

  const applyPreset = (f: number, l: number, s: number) => {
    setFixedPercentage(f);
    setLeisurePercentage(l);
    setSavingsPercentage(s);
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      showError('Por favor, introduce tu nombre');
      return;
    }
    if (!percentageValidation.valid) {
      showError(percentageValidation.error ?? 'Los porcentajes deben sumar 100%');
      return;
    }

    setSaving(true);
    try {
      // 1. Guardar nombre en el perfil
      const { error: profileError } = await updateProfile({
        display_name: displayName.trim(),
        currency: 'EUR',
        locale: 'es-ES',
      });

      if (profileError) {
        showError('Error al guardar el perfil');
        setSaving(false);
        return;
      }

      // 2. Guardar porcentajes en ajustes (40/30/30 por defecto)
      const { error: settingsError } = await updateSettings({
        fixed_percentage: fixedPercentage,
        leisure_percentage: leisurePercentage,
        savings_percentage: savingsPercentage,
        initial_balance: 0,
      });

      if (settingsError) {
        showError('Error al guardar los porcentajes');
        setSaving(false);
        return;
      }

      // 3. Crear categorías por defecto automáticamente según TRESORERIA URI
      if (user) {
        const categories = INITIAL_CATEGORIES.map((c, i) => ({
          user_id: user.id,
          name: c.name,
          section: c.section,
          sort_order: i,
        }));

        await supabase.from('categories').insert(categories);

        // Crear conceptos de ingreso por defecto (NÒMINA y EXTRES)
        await supabase.from('income_entries').insert([
          {
            user_id: user.id,
            description: 'NÒMINA',
            amount: 0,
            income_type: 'salary',
            budget_month: 1,
            budget_year: 2026,
            date: '2026-01-01',
          },
          {
            user_id: user.id,
            description: 'EXTRES',
            amount: 0,
            income_type: 'other',
            budget_month: 1,
            budget_year: 2026,
            date: '2026-01-01',
          },
        ]);
      }

      // 4. Completar onboarding
      await completeOnboarding();
      showSuccess('¡Todo listo!', 'Bienvenido a tu hoja Excel de tesorería.');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      showError('Error al completar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-emerald-50/20 to-surface-100 dark:from-surface-950 dark:via-emerald-950/15 dark:to-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#107c41] to-emerald-700 text-white shadow-lg shadow-emerald-600/25 mb-3">
            <FileSpreadsheet className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100">
            Bienvenido a tu Hoja de Tesorería
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Solo necesitamos tu nombre y qué porcentaje quieres usar.
          </p>
        </div>

        {/* Setup card */}
        <Card padding="lg" className="border border-surface-200 dark:border-surface-800 shadow-xl">
          <form onSubmit={handleFinish} className="space-y-6">
            {/* 1. Nombre */}
            <div>
              <label className="block text-sm font-semibold text-surface-900 dark:text-surface-100 mb-1.5">
                1. ¿Cómo te llamas?
              </label>
              <Input
                placeholder="Ej: Uriol, Oriol..."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* 2. Porcentajes */}
            <div className="space-y-4 pt-2 border-t border-surface-200 dark:border-surface-800">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-semibold text-surface-900 dark:text-surface-100">
                    2. ¿Qué porcentajes quieres usar?
                  </label>
                  <p className="text-xs text-surface-500">
                    Deben sumar 100%. (Podrás cambiarlos luego cuando quieras con un solo clic).
                  </p>
                </div>
              </div>

              {/* Presets rápidos */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset(40, 30, 30)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fixedPercentage === 40 && leisurePercentage === 30 && savingsPercentage === 30
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold flex items-center gap-1 text-surface-900 dark:text-surface-100">
                      <Sparkles className="h-3 w-3 text-emerald-500" /> Plantilla Uri (40/30/30)
                    </span>
                    {fixedPercentage === 40 && leisurePercentage === 30 && savingsPercentage === 30 && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-surface-500">40% Fijos · 30% Ocio · 30% Ahorro</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset(50, 30, 20)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    fixedPercentage === 50 && leisurePercentage === 30 && savingsPercentage === 20
                      ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                      : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold flex items-center gap-1 text-surface-900 dark:text-surface-100">
                      <Percent className="h-3 w-3 text-amber-500" /> Regla 50 / 30 / 20
                    </span>
                    {fixedPercentage === 50 && leisurePercentage === 30 && savingsPercentage === 20 && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-surface-500">50% Fijos · 30% Ocio · 20% Ahorro</p>
                </button>
              </div>

              {/* Sliders */}
              <div className="bg-surface-50 dark:bg-surface-800/40 p-4 rounded-xl border border-surface-200 dark:border-surface-800 space-y-4">
                {/* Fijos */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-slate-600 inline-block" /> Gastos Fijos (Sabadell / Revolut)
                    </span>
                    <span className="font-mono text-surface-900 dark:text-surface-100">{fixedPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={fixedPercentage}
                    onChange={(e) => setFixedPercentage(parseInt(e.target.value) || 0)}
                    className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-slate-600"
                  />
                </div>

                {/* Ocio */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Ocio y Variables (Revolut)
                    </span>
                    <span className="font-mono text-surface-900 dark:text-surface-100">{leisurePercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={leisurePercentage}
                    onChange={(e) => setLeisurePercentage(parseInt(e.target.value) || 0)}
                    className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Ahorro */}
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Inversión y Ahorro (MyInversor / Trade Republic)
                    </span>
                    <span className="font-mono text-surface-900 dark:text-surface-100">{savingsPercentage}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={savingsPercentage}
                    onChange={(e) => setSavingsPercentage(parseInt(e.target.value) || 0)}
                    className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                {/* Total indicator */}
                <div
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-medium ${
                    percentageValidation.valid
                      ? 'bg-success-50 border-success-200 text-success-700 dark:bg-success-900/20 dark:border-success-800/60 dark:text-success-400'
                      : 'bg-danger-50 border-danger-200 text-danger-700 dark:bg-danger-900/20 dark:border-danger-800/60 dark:text-danger-400'
                  }`}
                >
                  <span>Suma total:</span>
                  <span className="font-mono font-bold">
                    {fixedPercentage + leisurePercentage + savingsPercentage}% / 100%
                  </span>
                </div>
              </div>

              {/* Informative reassurance note */}
              <p className="text-xs text-surface-500 flex items-start gap-1.5">
                <span>💡</span>
                <span>
                  <strong>Nota:</strong> Podrás cambiar este porcentaje siempre que quieras directamente desde la barra superior del Excel o en Ajustes.
                </span>
              </p>
            </div>

            {/* Submit button */}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-[#107c41] hover:bg-[#0e6b37] text-white py-3 shadow-md"
              loading={saving}
              disabled={!displayName.trim() || !percentageValidation.valid}
              icon={<ArrowRight className="h-4 w-4" />}
            >
              Entrar a mi Hoja Excel Anual
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
