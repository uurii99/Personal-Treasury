import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { eurosToCents, centsToEuros } from '@/lib/money';
import { getTodayISO, getMonthYearFromDate } from '@/lib/dates';
import { Modal } from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui';
import { recordMovementInBank } from '@/lib/banks';
import type { Category, BudgetSection } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

const schema = z.object({
  amount: z.string().min(1, 'Introduce un importe'),
  date: z.string().min(1, 'Selecciona una fecha'),
  section: z.string().min(1, 'Selecciona un apartado'),
  category_id: z.string().min(1, 'Selecciona una categoría'),
  description: z.string().min(1, 'Introduce una descripción'),
});

type FormData = z.infer<typeof schema>;

export interface MovementEditData {
  id?: string;
  amountCents?: number;
  date?: string;
  section?: BudgetSection;
  categoryId?: string;
  description?: string;
}

interface AddMovementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month?: number;
  year?: number;
  defaultSection?: BudgetSection;
  defaultCategoryId?: string;
  initialData?: MovementEditData | null;
  onSaved: () => void;
}

export function AddMovementModal({
  open,
  onOpenChange,
  month: _month,
  year: _year,
  defaultSection,
  defaultCategoryId,
  initialData,
  onSaved,
}: AddMovementModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { language } = useLanguage();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(initialData?.id);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      date: getTodayISO(),
      section: defaultSection || 'fixed',
      category_id: defaultCategoryId || '',
      description: '',
    },
  });

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

  // Reset or fill form when opening or initialData changes
  useEffect(() => {
    if (!open) return;

    if (initialData) {
      form.reset({
        amount: initialData.amountCents != null ? centsToEuros(initialData.amountCents).toString().replace('.', ',') : '',
        date: initialData.date || getTodayISO(),
        section: initialData.section || defaultSection || 'fixed',
        category_id: initialData.categoryId || defaultCategoryId || '',
        description: initialData.description || '',
      });
    } else {
      form.reset({
        amount: '',
        date: getTodayISO(),
        section: defaultSection || 'fixed',
        category_id: defaultCategoryId || '',
        description: '',
      });
    }
  }, [open, initialData, defaultSection, defaultCategoryId, form]);

  const selectedSection = form.watch('section') as BudgetSection;
  const filteredCategories = categories.filter((c) => !selectedSection || c.section === selectedSection);

  // If section changed and category doesn't belong to it, reset category
  useEffect(() => {
    const curCatId = form.getValues('category_id');
    if (curCatId && filteredCategories.length > 0 && !filteredCategories.some((c) => c.id === curCatId)) {
      form.setValue('category_id', filteredCategories[0]?.id || '');
    }
  }, [selectedSection, filteredCategories, form]);

  const handleSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const amountCents = eurosToCents(parseFloat(data.amount.replace(',', '.')));
      if (isNaN(amountCents) || amountCents <= 0) {
        showError(language === 'ca' ? 'Introdueix un import vàlid' : 'Introduce un importe válido');
        return;
      }

      const { month: budgetMonth, year: budgetYear } = getMonthYearFromDate(data.date);

      if (isEditing && initialData?.id) {
        // Update existing movement
        const { error } = await supabase
          .from('transactions')
          .update({
            amount: amountCents,
            date: data.date,
            section: data.section,
            category_id: data.category_id || null,
            description: data.description.trim(),
            budget_month: budgetMonth,
            budget_year: budgetYear,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);

        if (error) {
          showError(language === 'ca' ? 'Error en actualitzar el moviment' : 'Error al actualizar el movimiento');
          console.error(error);
          return;
        }

        // Adjust banks
        const oldCents = initialData.amountCents || 0;
        const diff = amountCents - oldCents;
        if (diff !== 0) {
          recordMovementInBank(user.id, {
            type: 'expense',
            amountCents: Math.abs(diff),
            section: data.section as BudgetSection,
            description: data.description.trim(),
            operation: diff > 0 ? 'add' : 'remove',
          });
        }

        success(language === 'ca' ? 'Moviment actualitzat' : 'Movimiento actualizado', data.description);
      } else {
        // Create new movement
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
        });

        if (error) {
          showError(language === 'ca' ? 'Error en desar el moviment' : 'Error al guardar el movimiento');
          console.error(error);
          return;
        }

        // Update banks automatically
        recordMovementInBank(user.id, {
          type: 'expense',
          amountCents,
          section: data.section as BudgetSection,
          description: data.description.trim(),
        });

        success(language === 'ca' ? 'Despesa registrada' : 'Gasto registrado', data.description);
      }

      onOpenChange(false);
      onSaved();
    } catch {
      showError(language === 'ca' ? 'Error inesperat' : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing
          ? language === 'ca' ? 'Editar Despesa' : 'Editar Gasto'
          : language === 'ca' ? 'Nou Gasto' : 'Nuevo Gasto'
      }
      description={
        isEditing
          ? language === 'ca' ? 'Modifica les dades de la despesa' : 'Modifica los datos del gasto'
          : language === 'ca' ? 'Registra una nova despesa' : 'Registra un nuevo gasto'
      }
      size="md"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* 1. Importe */}
        <Input
          label={language === 'ca' ? 'Import' : 'Importe'}
          placeholder="0,00"
          suffix="€"
          error={form.formState.errors.amount?.message}
          {...form.register('amount')}
          autoFocus
        />

        {/* 2. Fecha */}
        <Input
          label={language === 'ca' ? 'Data' : 'Fecha'}
          type="date"
          error={form.formState.errors.date?.message}
          {...form.register('date')}
        />

        {/* 3. Apartado */}
        <Select
          label={language === 'ca' ? 'Apartat' : 'Apartado'}
          options={[
            { value: 'fixed', label: language === 'ca' ? '1. Despeses Fixes' : '1. Gastos Fijos' },
            { value: 'leisure', label: language === 'ca' ? '2. Oci i Despeses Variables' : '2. Ocio y Gastos Variables' },
            { value: 'savings', label: language === 'ca' ? '3. Estalvis i Inversió' : '3. Ahorros e Inversiones' },
          ]}
          error={form.formState.errors.section?.message}
          {...form.register('section')}
        />

        {/* 4. Categoría */}
        <Select
          label={language === 'ca' ? 'Categoria' : 'Categoría'}
          placeholder={language === 'ca' ? 'Selecciona una categoria' : 'Selecciona una categoría'}
          options={filteredCategories.map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          error={form.formState.errors.category_id?.message}
          {...form.register('category_id')}
        />

        {/* 5. Descripción */}
        <Input
          label={language === 'ca' ? 'Descripció' : 'Descripción'}
          placeholder={language === 'ca' ? 'Ex: compra supermercat, benzina moto...' : 'Ej: compra supermercado, gasolina moto...'}
          error={form.formState.errors.description?.message}
          {...form.register('description')}
        />

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
          </Button>
          <Button type="submit" loading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isEditing
              ? language === 'ca' ? 'Desar canvis' : 'Guardar cambios'
              : language === 'ca' ? 'Desar despesa' : 'Guardar gasto'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
