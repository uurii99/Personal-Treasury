import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { eurosToCents } from '@/lib/money';
import { getTodayISO, getMonthYearFromDate } from '@/lib/dates';
import { Modal } from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import { useCelebration } from '@/contexts/CelebrationContext';
import { recordMovementInBank } from '@/lib/banks';
import { getBankAccounts } from '@/lib/banks';

const schema = z.object({
  income_type: z.enum(['salary', 'extra']),
  // For salary
  salary_amount: z.string().optional(),
  // For extras
  extra_description: z.string().optional(),
  extra_amount: z.string().optional(),
  date: z.string().min(1, 'Selecciona una fecha'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddIncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  onSaved: () => void;
}

export function AddIncomeModal({ open, onOpenChange, month: _month, year: _year, onSaved }: AddIncomeModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { triggerNominaCelebration } = useCelebration();
  const [saving, setSaving] = useState(false);
  const [incomeType, setIncomeType] = useState<'salary' | 'extra'>('salary');

  const bankAccounts = user ? getBankAccounts(user.id) : [];
  const [selectedBank, setSelectedBank] = useState(bankAccounts[0]?.name || 'Banc Sabadell');

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      income_type: 'salary',
      salary_amount: '',
      extra_description: '',
      extra_amount: '',
      date: getTodayISO(),
      notes: '',
    },
  });

  const handleSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const isSalary = incomeType === 'salary';
      const rawAmount = isSalary ? data.salary_amount : data.extra_amount;
      const amountCents = eurosToCents(parseFloat((rawAmount || '0').replace(',', '.')));

      if (isNaN(amountCents) || amountCents <= 0) {
        showError('Introduce un importe válido');
        return;
      }

      if (!isSalary && !data.extra_description?.trim()) {
        showError('Introduce una descripción para el extra');
        return;
      }

      const { month: budgetMonth, year: budgetYear } = getMonthYearFromDate(data.date);
      const notesObj = JSON.stringify({ bank: selectedBank, rawConcept: isSalary ? 'NÒMINA' : data.extra_description?.trim() });

      if (isSalary) {
        // Save as NÒMINA
        const { error } = await supabase.from('income_entries').insert({
          user_id: user.id,
          description: 'NÒMINA',
          amount: amountCents,
          date: data.date,
          income_type: 'salary',
          budget_month: budgetMonth,
          budget_year: budgetYear,
          notes: notesObj,
        });
        if (error) { showError('Error al guardar el ingreso'); console.error(error); return; }
        triggerNominaCelebration(amountCents);
      } else {
        // Save as EXTRES with the user-provided description in notes
        const { error } = await supabase.from('income_entries').insert({
          user_id: user.id,
          description: 'EXTRES',
          amount: amountCents,
          date: data.date,
          income_type: 'other',
          budget_month: budgetMonth,
          budget_year: budgetYear,
          notes: notesObj,
        });
        if (error) { showError('Error al guardar el ingreso'); console.error(error); return; }
      }

      // Update bank
      recordMovementInBank(user.id, {
        type: 'income',
        amountCents,
        description: isSalary ? 'NÒMINA' : (data.extra_description?.trim() || 'EXTRES'),
      });

      success('Ingreso registrado', isSalary ? 'Nómina' : data.extra_description?.trim() || 'Extra');
      form.reset({ income_type: 'salary', salary_amount: '', extra_description: '', extra_amount: '', date: getTodayISO(), notes: '' });
      setIncomeType('salary');
      onOpenChange(false);
      onSaved();
    } catch {
      showError('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir ingreso"
      description="Registra un nuevo ingreso"
      size="md"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Type selector */}
        <div className="flex items-center gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={() => setIncomeType('salary')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              incomeType === 'salary'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            💼 Nómina
          </button>
          <button
            type="button"
            onClick={() => setIncomeType('extra')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              incomeType === 'extra'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            ✨ Extra / Otro
          </button>
        </div>

        {incomeType === 'salary' ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300">
              💡 Se guardará como <strong>NÒMINA</strong> en tu Excel.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Importe nómina"
                placeholder="0,00"
                suffix="€"
                error={form.formState.errors.salary_amount?.message}
                {...form.register('salary_amount')}
                autoFocus
              />
              <Input
                label="Fecha de cobro"
                type="date"
                error={form.formState.errors.date?.message}
                {...form.register('date')}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
              💡 Se guardará en <strong>EXTRES</strong>. Describe qué fue (ej: <em>Wallapop palanca cambios</em>).
            </div>
            <Input
              label="Descripción del ingreso"
              placeholder="Ej: Wallapop palanca cambios, regalo cumpleaños, freelance diseño..."
              error={form.formState.errors.extra_description?.message}
              {...form.register('extra_description')}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Importe"
                placeholder="0,00"
                suffix="€"
                error={form.formState.errors.extra_amount?.message}
                {...form.register('extra_amount')}
              />
              <Input
                label="Fecha"
                type="date"
                error={form.formState.errors.date?.message}
                {...form.register('date')}
              />
            </div>
          </div>
        )}

        {/* Bank selector */}
        {bankAccounts.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
              Banco destino
            </label>
            <div className="flex flex-wrap gap-2">
              {bankAccounts.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBank(b.name)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    selectedBank === b.name
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:border-brand-400'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Notas (opcional)"
          placeholder="Notas adicionales..."
          {...form.register('notes')}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar ingreso
          </Button>
        </div>
      </form>
    </Modal>
  );
}
