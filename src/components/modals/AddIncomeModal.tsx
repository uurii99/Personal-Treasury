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
import { Button, Input } from '@/components/ui';
import { useCelebration } from '@/contexts/CelebrationContext';
import { recordMovementInBank, getBankAccounts } from '@/lib/banks';

const schema = z.object({
  income_type: z.enum(['salary', 'extra']),
  // For salary
  salary_amount: z.string().optional(),
  // For extras
  extra_description: z.string().optional(),
  extra_amount: z.string().optional(),
  date: z.string().min(1, 'Selecciona una fecha'),
});

type FormData = z.infer<typeof schema>;

export interface IncomeEditData {
  id?: string;
  income_type?: 'salary' | 'other';
  amountCents?: number;
  date?: string;
  description?: string;
  bank?: string;
}

interface AddIncomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month?: number;
  year?: number;
  defaultType?: 'salary' | 'extra';
  initialData?: IncomeEditData | null;
  onSaved: () => void;
}

export function AddIncomeModal({
  open,
  onOpenChange,
  month: _month,
  year: _year,
  defaultType = 'salary',
  initialData,
  onSaved,
}: AddIncomeModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { language } = useLanguage();
  const { triggerNominaCelebration } = useCelebration();
  const [saving, setSaving] = useState(false);
  const [incomeType, setIncomeType] = useState<'salary' | 'extra'>(defaultType);

  const bankAccounts = user ? getBankAccounts(user.id) : [];
  const [selectedBank, setSelectedBank] = useState(bankAccounts[0]?.name || 'Banc Sabadell');

  const isEditing = Boolean(initialData?.id);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      income_type: 'salary',
      salary_amount: '',
      extra_description: '',
      extra_amount: '',
      date: getTodayISO(),
    },
  });

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      const isSal = initialData.income_type === 'salary';
      setIncomeType(isSal ? 'salary' : 'extra');
      const amtStr = initialData.amountCents != null ? centsToEuros(initialData.amountCents).toString().replace('.', ',') : '';
      if (initialData.bank) setSelectedBank(initialData.bank);

      form.reset({
        income_type: isSal ? 'salary' : 'extra',
        salary_amount: isSal ? amtStr : '',
        extra_description: isSal ? '' : (initialData.description || ''),
        extra_amount: isSal ? '' : amtStr,
        date: initialData.date || getTodayISO(),
      });
    } else {
      setIncomeType(defaultType);
      form.reset({
        income_type: defaultType,
        salary_amount: '',
        extra_description: '',
        extra_amount: '',
        date: getTodayISO(),
      });
      if (bankAccounts.length > 0) {
        setSelectedBank(bankAccounts[0].name);
      }
    }
  }, [open, initialData, defaultType, form]);

  const handleSubmit = async (data: FormData) => {
    if (!user) return;
    setSaving(true);

    try {
      const isSalary = incomeType === 'salary';
      const rawAmount = isSalary ? data.salary_amount : data.extra_amount;
      const amountCents = eurosToCents(parseFloat((rawAmount || '0').replace(',', '.')));

      if (isNaN(amountCents) || amountCents <= 0) {
        showError(language === 'ca' ? 'Introdueix un import vàlid' : 'Introduce un importe válido');
        return;
      }

      if (!isSalary && !data.extra_description?.trim()) {
        showError(language === 'ca' ? 'Introdueix una descripció per a l\'extra' : 'Introduce una descripción para el extra');
        return;
      }

      const { month: budgetMonth, year: budgetYear } = getMonthYearFromDate(data.date);
      const extraDesc = data.extra_description?.trim() || '';
      const notesObj = JSON.stringify({
        bank: selectedBank,
        rawConcept: isSalary ? 'NÒMINA' : extraDesc,
        description: isSalary ? 'NÒMINA' : extraDesc,
      });

      if (isEditing && initialData?.id) {
        // Update existing income entry
        const { error } = await supabase
          .from('income_entries')
          .update({
            description: isSalary ? 'NÒMINA' : 'EXTRES',
            amount: amountCents,
            date: data.date,
            income_type: isSalary ? 'salary' : 'other',
            budget_month: budgetMonth,
            budget_year: budgetYear,
            notes: notesObj,
            updated_at: new Date().toISOString(),
          })
          .eq('id', initialData.id);

        if (error) {
          showError(language === 'ca' ? 'Error en actualitzar l\'ingrés' : 'Error al actualizar el ingreso');
          console.error(error);
          return;
        }

        // Adjust bank balance
        const oldCents = initialData.amountCents || 0;
        const diff = amountCents - oldCents;
        if (diff !== 0) {
          recordMovementInBank(user.id, {
            type: 'income',
            amountCents: Math.abs(diff),
            description: isSalary ? 'NÒMINA' : extraDesc || 'EXTRES',
            operation: diff > 0 ? 'add' : 'remove',
          });
        }

        success(language === 'ca' ? 'Ingrés actualitzat' : 'Ingreso actualizado', isSalary ? 'Nómina' : extraDesc);
      } else {
        // Create new income entry
        const { error } = await supabase.from('income_entries').insert({
          user_id: user.id,
          description: isSalary ? 'NÒMINA' : 'EXTRES',
          amount: amountCents,
          date: data.date,
          income_type: isSalary ? 'salary' : 'other',
          budget_month: budgetMonth,
          budget_year: budgetYear,
          notes: notesObj,
        });

        if (error) {
          showError(language === 'ca' ? 'Error en desar l\'ingrés' : 'Error al guardar el ingreso');
          console.error(error);
          return;
        }

        if (isSalary) {
          triggerNominaCelebration(amountCents);
        }

        // Update bank
        recordMovementInBank(user.id, {
          type: 'income',
          amountCents,
          description: isSalary ? 'NÒMINA' : extraDesc || 'EXTRES',
        });

        success(language === 'ca' ? 'Ingrés registrat' : 'Ingreso registrado', isSalary ? 'Nómina' : extraDesc);
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
          ? language === 'ca' ? 'Editar Ingrés' : 'Editar Ingreso'
          : language === 'ca' ? 'Afegir Ingrés' : 'Añadir Ingreso'
      }
      description={
        isEditing
          ? language === 'ca' ? 'Modifica les dades de l\'ingrés' : 'Modifica los datos del ingreso'
          : language === 'ca' ? 'Registra una nova nòmina o ingrés extra' : 'Registra una nueva nómina o ingreso extra'
      }
      size="md"
    >
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Type selector */}
        <div className="flex items-center gap-2 p-1 bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700">
          <button
            type="button"
            onClick={() => {
              setIncomeType('salary');
              form.setValue('income_type', 'salary');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              incomeType === 'salary'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            💼 {language === 'ca' ? 'Nòmina' : 'Nómina'}
          </button>
          <button
            type="button"
            onClick={() => {
              setIncomeType('extra');
              form.setValue('income_type', 'extra');
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
              incomeType === 'extra'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-100'
            }`}
          >
            ✨ {language === 'ca' ? 'Extra / Altre' : 'Extra / Otro'}
          </button>
        </div>

        {incomeType === 'salary' ? (
          <div className="space-y-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300">
              💡 {language === 'ca' ? 'Es desarà com a' : 'Se guardará como'} <strong>NÒMINA</strong> {language === 'ca' ? 'al teu Excel.' : 'en tu Excel.'}
            </div>

            {/* 1. Importe nómina */}
            <Input
              label={language === 'ca' ? 'Import nòmina' : 'Importe nómina'}
              placeholder="0,00"
              suffix="€"
              error={form.formState.errors.salary_amount?.message}
              {...form.register('salary_amount')}
              autoFocus
            />

            {/* 2. Fecha */}
            <Input
              label={language === 'ca' ? 'Data de cobrament' : 'Fecha de cobro'}
              type="date"
              error={form.formState.errors.date?.message}
              {...form.register('date')}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
              💡 {language === 'ca' ? 'Es desarà a' : 'Se guardará en'} <strong>EXTRES</strong>. {language === 'ca' ? 'Indica el motiu (ex: venda Wallapop palanca canvis).' : 'Indica el motivo (ej: venta Wallapop palanca cambios).'}
            </div>

            {/* 1. Descripción */}
            <Input
              label={language === 'ca' ? 'Descripció de l\'ingrés' : 'Descripción del ingreso'}
              placeholder={language === 'ca' ? 'Ex: Wallapop palanca canvis, regal...' : 'Ej: Wallapop palanca cambios, regalo cumpleaños, freelance...'}
              error={form.formState.errors.extra_description?.message}
              {...form.register('extra_description')}
              autoFocus
            />

            {/* 2. Importe */}
            <Input
              label={language === 'ca' ? 'Import' : 'Importe'}
              placeholder="0,00"
              suffix="€"
              error={form.formState.errors.extra_amount?.message}
              {...form.register('extra_amount')}
            />

            {/* 3. Fecha */}
            <Input
              label={language === 'ca' ? 'Data' : 'Fecha'}
              type="date"
              error={form.formState.errors.date?.message}
              {...form.register('date')}
            />
          </div>
        )}

        {/* 3/4. Banco destino */}
        {bankAccounts.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-surface-700 dark:text-surface-300 mb-1.5">
              {language === 'ca' ? 'Banc destí' : 'Banco destino'}
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

        <div className="flex justify-end gap-3 pt-3 border-t border-surface-200 dark:border-surface-800">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
          </Button>
          <Button type="submit" loading={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isEditing
              ? language === 'ca' ? 'Desar canvis' : 'Guardar cambios'
              : language === 'ca' ? 'Desar ingrés' : 'Guardar ingreso'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
