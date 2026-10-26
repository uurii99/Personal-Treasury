import { useState, useEffect } from 'react';
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
import { recordMovementInBank } from '@/lib/banks';
import type { Category, BudgetSection } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

const schema = z.object({
  description: z.string().min(1, 'Introduce una descripción'),
  amount: z.string().min(1, 'Introduce un importe'),
  section: z.string().min(1, 'Selecciona un apartado'),
  category_id: z.string().optional(),
  date: z.string().min(1, 'Selecciona una fecha'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface AddMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number;
  year: number;
  onSaved: () => void;
}

export function AddMovementModal({ open, onOpenChange, month, year, onSaved }: AddMovementModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      amount: '',
      section: '',
      category_id: '',
      date: getTodayISO(),
      notes: '',
    },
  });

  const selectedSection = form.watch('section') as BudgetSection;

  // Load categories
  useEffect(() => {
    if (!user || !open) return;
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_archived', false)
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []));
  }, [user, open]);

  const filteredCategories = categories.filter((c) => !selectedSection || c.section === selectedSection);

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

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'expense',
        amount: amountCents,
        description: data.description.trim(),
        category_id: data.category_id || null,
        section: data.section,
        date: data.date,
        budget_month: budgetMonth,
        budget_year: budgetYear,
        notes: data.notes?.trim() || null,
      });

      if (error) {
        showError('Error al guardar el movimiento');
        console.error(error);
        return;
      }

      // Automatically update banks
      recordMovementInBank(user.id, {
        type: 'expense',
        amountCents,
        section: data.section as BudgetSection,
        description: data.description,
      });

      success('Movimiento registrado', data.description);
      form.reset({
        description: '',
        amount: '',
        section: '',
        category_id: '',
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

  // Auto-set section from category
  useEffect(() => {
    const categoryId = form.watch('category_id');
    if (categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        form.setValue('section', cat.section);
      }
    }
  }, [form.watch('category_id')]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir movimiento"
      description="Registra un nuevo gasto"
      size="md"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Input
          label="Descripción"
          placeholder="Ej: Desayuno en una cafetería"
          error={form.formState.errors.description?.message}
          {...form.register('description')}
          autoFocus
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

        <Select
          label="Apartado"
          placeholder="Selecciona un apartado"
          options={[
            { value: 'fixed', label: BUDGET_SECTION_LABELS.fixed },
            { value: 'leisure', label: BUDGET_SECTION_LABELS.leisure },
            { value: 'savings', label: BUDGET_SECTION_LABELS.savings },
          ]}
          error={form.formState.errors.section?.message}
          {...form.register('section')}
        />

        {filteredCategories.length > 0 && (
          <Select
            label="Categoría (opcional)"
            placeholder="Selecciona una categoría"
            options={filteredCategories.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            {...form.register('category_id')}
          />
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
            Guardar movimiento
          </Button>
        </div>
      </form>
    </Modal>
  );
}
