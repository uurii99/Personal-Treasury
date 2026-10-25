import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, ChevronLeft, Wallet, Percent, Tag, Banknote } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, Input, Card } from '@/components/ui';
import { eurosToCents, formatCurrency, validatePercentages, distributeByPercentage } from '@/lib/money';
import type { BudgetSection } from '@/types';

interface OnboardingData {
  displayName: string;
  fixedPercentage: number;
  leisurePercentage: number;
  savingsPercentage: number;
  initialBalance: string;
  selectedCategories: string[];
}

const DEFAULT_CATEGORIES: { name: string; section: BudgetSection; default: boolean }[] = [
  // Fixed
  { name: 'Gimnasio', section: 'fixed', default: true },
  { name: 'Seguro de moto', section: 'fixed', default: true },
  { name: 'Corte de pelo', section: 'fixed', default: true },
  { name: 'Suscripciones', section: 'fixed', default: true },
  { name: 'Teléfono', section: 'fixed', default: true },
  { name: 'Transporte habitual', section: 'fixed', default: false },
  { name: 'Otros gastos fijos', section: 'fixed', default: true },
  // Leisure
  { name: 'Desayunos', section: 'leisure', default: true },
  { name: 'Comidas y cenas', section: 'leisure', default: true },
  { name: 'Restaurantes', section: 'leisure', default: true },
  { name: 'Viajes', section: 'leisure', default: false },
  { name: 'Piezas de moto', section: 'leisure', default: false },
  { name: 'Compras', section: 'leisure', default: true },
  { name: 'Entretenimiento', section: 'leisure', default: true },
  { name: 'Otros gastos variables', section: 'leisure', default: true },
  // Savings
  { name: 'Fondo de emergencia', section: 'savings', default: true },
  { name: 'Ahorro general', section: 'savings', default: true },
  { name: 'Inversiones', section: 'savings', default: false },
  { name: 'Objetivos de ahorro', section: 'savings', default: true },
];

const SECTION_LABELS: Record<BudgetSection, string> = {
  fixed: 'Gastos fijos',
  leisure: 'Ocio y variables',
  savings: 'Ahorros',
};

const SECTION_COLORS: Record<BudgetSection, string> = {
  fixed: 'bg-brand-50 text-brand-700 border-brand-200 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-800',
  leisure: 'bg-warning-50 text-warning-500 border-warning-200 dark:bg-warning-100/10 dark:text-warning-400 dark:border-warning-300/20',
  savings: 'bg-savings-50 text-savings-600 border-savings-200 dark:bg-savings-900/30 dark:text-savings-400 dark:border-savings-800',
};

const steps = [
  { title: 'Tu nombre', icon: <Wallet className="h-5 w-5" /> },
  { title: 'Porcentajes', icon: <Percent className="h-5 w-5" /> },
  { title: 'Categorías', icon: <Tag className="h-5 w-5" /> },
  { title: 'Saldo inicial', icon: <Banknote className="h-5 w-5" /> },
];

export function OnboardingPage() {
  const { updateProfile, updateSettings, completeOnboarding, user } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [data, setData] = useState<OnboardingData>({
    displayName: '',
    fixedPercentage: 40,
    leisurePercentage: 30,
    savingsPercentage: 30,
    initialBalance: '',
    selectedCategories: DEFAULT_CATEGORIES.filter((c) => c.default).map((c) => c.name),
  });

  const percentageValidation = validatePercentages(
    data.fixedPercentage,
    data.leisurePercentage,
    data.savingsPercentage
  );

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return data.displayName.trim().length > 0;
      case 1:
        return percentageValidation.valid;
      case 2:
        return data.selectedCategories.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await updateProfile({
        display_name: data.displayName.trim(),
        currency: 'EUR',
        locale: 'es-ES',
      });

      if (profileError) {
        showError('Error al guardar el perfil');
        return;
      }

      // Update settings
      const balanceCents = data.initialBalance
        ? eurosToCents(parseFloat(data.initialBalance.replace(',', '.')))
        : 0;

      const { error: settingsError } = await updateSettings({
        fixed_percentage: data.fixedPercentage,
        leisure_percentage: data.leisurePercentage,
        savings_percentage: data.savingsPercentage,
        initial_balance: balanceCents,
      });

      if (settingsError) {
        showError('Error al guardar la configuración');
        return;
      }

      // Create selected categories
      if (user) {
        const categories = data.selectedCategories.map((name, i) => {
          const cat = DEFAULT_CATEGORIES.find((c) => c.name === name);
          return {
            user_id: user.id,
            name,
            section: cat?.section ?? 'leisure',
            sort_order: i,
          };
        });

        const { error: catError } = await (await import('@/lib/supabase')).supabase
          .from('categories')
          .insert(categories);

        if (catError) {
          console.error('Error creating categories:', catError);
        }
      }

      // Complete onboarding
      await completeOnboarding();
      showSuccess('¡Configuración completada!', 'Tu tesorería está lista.');
      navigate('/dashboard');
    } catch {
      showError('Error al completar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (name: string) => {
    setData((prev) => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(name)
        ? prev.selectedCategories.filter((c) => c !== name)
        : [...prev.selectedCategories, name],
    }));
  };

  // Preview distribution with example salary
  const exampleSalary = 150000; // 1500€ in cents
  const previewDistribution = percentageValidation.valid
    ? distributeByPercentage(exampleSalary, [data.fixedPercentage, data.leisurePercentage, data.savingsPercentage])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-brand-50/20 to-surface-100 dark:from-surface-950 dark:via-brand-950/10 dark:to-surface-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-100 mb-1">
            Vamos a configurar tu tesorería
          </h1>
          <p className="text-sm text-surface-500">
            Paso {currentStep + 1} de {steps.length} — {steps[currentStep].title}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 px-4">
          {steps.map((step, i) => (
            <div key={i} className="flex-1 flex items-center gap-2">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all duration-300
                  ${i < currentStep
                    ? 'bg-success-500 text-white'
                    : i === currentStep
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/30'
                    : 'bg-surface-200 text-surface-500 dark:bg-surface-800 dark:text-surface-400'
                  }
                `}
              >
                {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${
                    i < currentStep ? 'bg-success-500' : 'bg-surface-200 dark:bg-surface-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card padding="lg" className="animate-[fade-in_300ms_ease-out]">
          {/* Step 0: Name */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                ¿Cómo te llamas?
              </h2>
              <p className="text-sm text-surface-500">
                Este nombre aparecerá en tu perfil.
              </p>
              <Input
                label="Nombre visible"
                placeholder="Tu nombre"
                value={data.displayName}
                onChange={(e) => setData({ ...data, displayName: e.target.value })}
                autoFocus
              />
            </div>
          )}

          {/* Step 1: Percentages */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Elige tus porcentajes
                </h2>
                <p className="text-sm text-surface-500 mt-1">
                  Define cómo distribuir tus ingresos. Deben sumar 100%.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  { key: 'fixedPercentage' as const, label: 'Gastos fijos', color: 'brand' },
                  { key: 'leisurePercentage' as const, label: 'Ocio y gastos variables', color: 'warning' },
                  { key: 'savingsPercentage' as const, label: 'Ahorros e inversiones', color: 'savings' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                        {label}
                      </label>
                      <span className="text-sm font-mono text-surface-500 tabular-nums">
                        {data[key]}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={data[key]}
                      onChange={(e) => setData({ ...data, [key]: parseInt(e.target.value) })}
                      className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-brand-600"
                    />
                  </div>
                ))}
              </div>

              {/* Sum indicator */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${
                percentageValidation.valid
                  ? 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800/50'
                  : 'bg-danger-50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800/50'
              }`}>
                <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Total
                </span>
                <span className={`text-sm font-bold tabular-nums ${
                  percentageValidation.valid ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
                }`}>
                  {data.fixedPercentage + data.leisurePercentage + data.savingsPercentage}%
                </span>
              </div>

              {/* Preview */}
              {previewDistribution && (
                <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
                  <p className="text-xs font-medium text-surface-500 mb-2">
                    Ejemplo con nómina de 1.500 €:
                  </p>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-600 dark:text-surface-400">Gastos fijos</span>
                    <span className="font-mono tabular-nums text-surface-900 dark:text-surface-100">{formatCurrency(previewDistribution[0])}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-600 dark:text-surface-400">Ocio</span>
                    <span className="font-mono tabular-nums text-surface-900 dark:text-surface-100">{formatCurrency(previewDistribution[1])}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-600 dark:text-surface-400">Ahorros</span>
                    <span className="font-mono tabular-nums text-surface-900 dark:text-surface-100">{formatCurrency(previewDistribution[2])}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Categories */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Elige tus categorías
                </h2>
                <p className="text-sm text-surface-500 mt-1">
                  Puedes añadir o modificar categorías más tarde.
                </p>
              </div>

              {(['fixed', 'leisure', 'savings'] as BudgetSection[]).map((section) => (
                <div key={section}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-surface-400 mb-2">
                    {SECTION_LABELS[section]}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_CATEGORIES.filter((c) => c.section === section).map((cat) => {
                      const selected = data.selectedCategories.includes(cat.name);
                      return (
                        <button
                          key={cat.name}
                          onClick={() => toggleCategory(cat.name)}
                          className={`
                            px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150
                            ${selected
                              ? SECTION_COLORS[section]
                              : 'bg-white dark:bg-surface-800 text-surface-500 border-surface-200 dark:border-surface-700 hover:border-surface-300'
                            }
                          `}
                        >
                          {selected && <Check className="h-3 w-3 inline mr-1" />}
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Initial balance */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-100">
                  Saldo inicial (opcional)
                </h2>
                <p className="text-sm text-surface-500 mt-1">
                  Si quieres, indica tu saldo actual para hacer un seguimiento más preciso. Puedes dejarlo en blanco.
                </p>
              </div>
              <Input
                label="Saldo inicial"
                type="text"
                placeholder="0,00"
                suffix="€"
                value={data.initialBalance}
                onChange={(e) => setData({ ...data, initialBalance: e.target.value })}
                hint="Puedes modificarlo en cualquier momento desde la configuración."
              />
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-4 border-t border-surface-200 dark:border-surface-800">
            <Button
              variant="ghost"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              disabled={currentStep === 0}
              icon={<ChevronLeft className="h-4 w-4" />}
            >
              Anterior
            </Button>

            {currentStep < steps.length - 1 ? (
              <Button
                onClick={() => setCurrentStep((prev) => prev + 1)}
                disabled={!canProceed()}
                icon={<ChevronRight className="h-4 w-4" />}
              >
                Siguiente
              </Button>
            ) : (
              <Button onClick={handleFinish} loading={saving} icon={<Check className="h-4 w-4" />}>
                Empezar
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
