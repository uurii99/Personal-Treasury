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
import { Button, Input, Select } from '@/components/ui';
import { useCelebration } from '@/contexts/CelebrationContext';
import { recordMovementInBank } from '@/lib/banks';
import { INCOME_TYPE_LABELS, type IncomeType } from '@/types';

const schema = z.object({
  description: z.string().min(1, 'Introduce una descripción'),
  amount: z.string().min(1, 'Introduce un importe'),
  income_type: z.string().min(1, 'Selecciona un tipo'),
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

export function AddIncomeModal({ open, onOpenChange, month, year, onSaved }: AddIncomeModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { triggerNominaCelebration } = useCelebration();
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      amount: '',
      income_type: 'salary',
      date: getTodayISO(),
      notes: '',
    },
  });

  const handleSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const amountCents = eurosToCents(parseFloat(data.amount.replace(',', '.')));
      if (isNaN(amountCents) || amountCents <= 0) {
        showError('Introduce un importe válido');
        return;
      }

      const { month: budgetMonth, year: budgetYear } = getMonthYearFromDate(data.date);

      const { error } = await supabase.from('income_entries').insert({
        user_id: user.id,
        description: data.description.trim(),
        amount: amountCents,
        date: data.date,
        income_type: data.income_type,
        budget_month: budgetMonth,
        budget_year: budgetYear,
        notes: data.notes?.trim() || null,
      });

      if (error) {
        showError('Error al guardar el ingreso');
        console.error(error);
        return;
      }

      // Update banks automatically
      recordMovementInBank(user.id, {
        type: 'income',
        amountCents,
        description: data.description,
      });

      // If Nómina, trigger Donald Duck money celebration GIF!
      const isNomina =
        data.income_type === 'salary' ||
        data.description.toLowerCase().includes('nomina') ||
        data.description.toLowerCase().includes('nòmina');
      if (isNomina) {
        triggerNominaCelebration(amountCents);
      }

      success('Ingreso registrado', data.description);
      form.reset({
        description: '',
        amount: '',
        income_type: 'salary',
        date: getTodayISO(),
        notes: '',
      });
      onOpenChange(false);
      onSaved();
    } catch {
      showError('Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const incomeTypeOptions = Object.entries(INCOME_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir ingreso"
      description="Registra un nuevo ingreso"
      size="md"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Select
          label="Tipo de ingreso"
          options={incomeTypeOptions}
          error={form.formState.errors.income_type?.message}
          {...form.register('income_type')}
        />

        <Input
          label="Descripción"
          placeholder="Ej: Nómina de octubre"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Importe"
            placeholder="0,00"
            suffix="€"
            error={form.formState.errors.amount?.message}
            {...form.register('amount')}
          />
          <Input
            label="Fecha"
            type="date"
            error={form.formState.errors.date?.message}
            {...form.register('date')}
          />
        </div>

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
