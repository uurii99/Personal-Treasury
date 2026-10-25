import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Card, CardHeader, Button, Input } from '@/components/ui';
import { Settings, Percent, Wallet } from 'lucide-react';
import { formatCurrency, eurosToCents, validatePercentages, distributeByPercentage } from '@/lib/money';

export function SettingsPage() {
  const { settings, updateSettings } = useAuth();
  const { success, error: showError } = useToast();
  const [saving, setSaving] = useState(false);

  const [fixed, setFixed] = useState(settings?.fixed_percentage ?? 40);
  const [leisure, setLeisure] = useState(settings?.leisure_percentage ?? 30);
  const [savings, setSavings] = useState(settings?.savings_percentage ?? 30);
  const [initialBalance, setInitialBalance] = useState(
    settings?.initial_balance ? (settings.initial_balance / 100).toFixed(2).replace('.', ',') : ''
  );

  const validation = validatePercentages(fixed, leisure, savings);
  const previewTotal = 150000; // 1500€
  const preview = validation.valid ? distributeByPercentage(previewTotal, [fixed, leisure, savings]) : null;

  const handleSave = async () => {
    if (!validation.valid) {
      showError(validation.error ?? 'Porcentajes inválidos');
      return;
    }
    setSaving(true);
    try {
      const balanceCents = initialBalance
        ? eurosToCents(parseFloat(initialBalance.replace(',', '.')))
        : 0;

      const { error } = await updateSettings({
        fixed_percentage: fixed,
        leisure_percentage: leisure,
        savings_percentage: savings,
        initial_balance: isNaN(balanceCents) ? 0 : balanceCents,
      });

      if (error) showError('Error al guardar');
      else success('Configuración guardada');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Configuración</h1>

      {/* Percentages */}
      <Card>
        <CardHeader title="Distribución presupuestaria" description="Define cómo se reparten tus ingresos. Deben sumar 100%." icon={<Percent className="h-5 w-5" />} />

        <div className="space-y-4">
          {[
            { label: 'Gastos fijos', value: fixed, set: setFixed },
            { label: 'Ocio y gastos variables', value: leisure, set: setLeisure },
            { label: 'Ahorros e inversiones', value: savings, set: setSavings },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">{label}</label>
                <span className="text-sm font-mono tabular-nums text-surface-500">{value}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(e) => set(parseInt(e.target.value))}
                className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-full appearance-none cursor-pointer accent-brand-600"
              />
            </div>
          ))}

          <div className={`flex items-center justify-between p-3 rounded-lg border ${
            validation.valid
              ? 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800/50'
              : 'bg-danger-50 border-danger-200 dark:bg-danger-900/20 dark:border-danger-800/50'
          }`}>
            <span className="text-sm font-medium">Total</span>
            <span className={`text-sm font-bold tabular-nums ${validation.valid ? 'text-success-600' : 'text-danger-600'}`}>
              {fixed + leisure + savings}%
            </span>
          </div>

          {preview && (
            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 space-y-1">
              <p className="text-xs font-medium text-surface-500 mb-2">Vista previa con 1.500 €:</p>
              <div className="flex justify-between text-xs"><span>Gastos fijos</span><span className="font-mono tabular-nums">{formatCurrency(preview[0])}</span></div>
              <div className="flex justify-between text-xs"><span>Ocio</span><span className="font-mono tabular-nums">{formatCurrency(preview[1])}</span></div>
              <div className="flex justify-between text-xs"><span>Ahorros</span><span className="font-mono tabular-nums">{formatCurrency(preview[2])}</span></div>
            </div>
          )}
        </div>
      </Card>

      {/* Initial balance */}
      <Card>
        <CardHeader title="Saldo inicial" description="Punto de partida para el seguimiento de tu patrimonio." icon={<Wallet className="h-5 w-5" />} />
        <Input
          label="Saldo inicial"
          placeholder="0,00"
          suffix="€"
          value={initialBalance}
          onChange={(e) => setInitialBalance(e.target.value)}
        />
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={saving} disabled={!validation.valid}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
