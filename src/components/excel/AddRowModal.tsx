import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { eurosToCents } from '@/lib/money';
import type { BudgetSection } from '@/types';

interface AddRowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSection?: 'income' | BudgetSection;
  year: number;
  onSaved: () => void;
}

export function AddRowModal({ open, onOpenChange, defaultSection = 'fixed', year, onSaved }: AddRowModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { language } = useLanguage();

  const [targetTable, setTargetTable] = useState<'income' | BudgetSection>(defaultSection);
  const [name, setName] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [fillAllMonths, setFillAllMonths] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      showError(language === 'ca' ? 'Introdueix un nom per al nou concepte' : 'Introduce un nombre para el nuevo concepto');
      return;
    }

    setSaving(true);
    try {
      const parsedAmount = defaultAmount.trim() ? parseFloat(defaultAmount.replace(',', '.')) : 0;
      const cents = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : eurosToCents(parsedAmount);

      if (targetTable === 'income') {
        // Income row
        if (cents > 0) {
          const monthsToInsert = fillAllMonths
            ? Array.from({ length: 12 }, (_, i) => i + 1)
            : [1]; // Enero by default if not filling all

          const entries = monthsToInsert.map((m) => ({
            user_id: user.id,
            description: trimmedName,
            amount: cents,
            income_type: 'other',
            budget_month: m,
            budget_year: year,
            date: `${year}-${String(m).padStart(2, '0')}-01`,
          }));

          await supabase.from('income_entries').insert(entries);
        } else {
          // Create at least 1 entry with 1 cent or dummy, or just rely on state
          // To register an income concept so it displays as a row, create an initial entry for month 1
          await supabase.from('income_entries').insert({
            user_id: user.id,
            description: trimmedName,
            amount: 1, // 1 cent to register concept, can be edited
            income_type: 'other',
            budget_month: 1,
            budget_year: year,
            date: `${year}-01-01`,
          });
        }
      } else {
        // Category in section (fixed, leisure, savings)
        const { data: newCat, error: catError } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: trimmedName,
            section: targetTable,
            sort_order: 99,
          })
          .select('id')
          .single();

        if (catError) {
          console.error(catError);
          showError('Error al crear la categoría');
          setSaving(false);
          return;
        }

        // If an initial amount was specified
        if (cents > 0 && newCat) {
          const monthsToInsert = fillAllMonths
            ? Array.from({ length: 12 }, (_, i) => i + 1)
            : [1];

          const transactions = monthsToInsert.map((m) => ({
            user_id: user.id,
            type: 'expense',
            amount: cents,
            description: trimmedName,
            category_id: newCat.id,
            section: targetTable,
            budget_month: m,
            budget_year: year,
            date: `${year}-${String(m).padStart(2, '0')}-01`,
          }));

          await supabase.from('transactions').insert(transactions);
        }
      }

      success(
        language === 'ca' ? "Fila afegida a l'Excel" : 'Fila añadida al Excel',
        language === 'ca' ? `S'ha creat "${trimmedName}"` : `Se ha creado "${trimmedName}"`
      );
      setName('');
      setDefaultAmount('');
      setFillAllMonths(false);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error(e);
      showError(language === 'ca' ? 'Error en desar la nova fila' : 'Error al guardar la nueva fila');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={language === 'ca' ? 'Afegir nova fila / concepte' : 'Añadir nueva fila / concepto'}
      description={
        language === 'ca'
          ? 'Crea un nou concepte per registrar imports a la teva fulla Excel anual.'
          : 'Crea un nuevo concepto para registrar importes en tu hoja Excel anual.'
      }
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <Select
          label={language === 'ca' ? 'A quina taula vols afegir-ho?' : '¿En qué tabla quieres añadirlo?'}
          value={targetTable}
          onChange={(e) => setTargetTable(e.target.value as 'income' | BudgetSection)}
          options={[
            { value: 'income', label: language === 'ca' ? '🟢 1. Ingressos' : '🟢 1. Ingresos' },
            { value: 'fixed', label: language === 'ca' ? '🔵 2. Despeses Fixes' : '🔵 2. Gastos Fijos' },
            { value: 'leisure', label: language === 'ca' ? '🟡 3. Opcional i Variables' : '🟡 3. Ocio y Gastos Variables' },
            { value: 'savings', label: language === 'ca' ? '🟣 4. Inversions i Estalvi' : '🟣 4. Inversiones y Ahorro' },
          ]}
        />

        <Input
          label={language === 'ca' ? 'Nom del concepte o categoria' : 'Nombre del concepto o categoría'}
          placeholder={
            language === 'ca'
              ? "Ex: Classes d'anglès, Assegurança de la llar, Fons Indexats..."
              : 'Ej: Clases de inglés, Seguro de hogar, Fondos Indexados...'
          }
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          label={language === 'ca' ? 'Import mensual inicial (opcional)' : 'Importe mensual inicial (opcional)'}
          placeholder="0,00"
          suffix="€"
          value={defaultAmount}
          onChange={(e) => setDefaultAmount(e.target.value)}
          hint={
            language === 'ca'
              ? 'Pots deixar-ho a 0 i omplir les cel·les directament a la taula.'
              : 'Puedes dejarlo en 0 y rellenar las celdas directamente en la tabla.'
          }
        />

        {defaultAmount.trim() !== '' && parseFloat(defaultAmount.replace(',', '.')) > 0 && (
          <label className="flex items-center gap-2 cursor-pointer text-xs text-surface-600 dark:text-surface-300">
            <input
              type="checkbox"
              checked={fillAllMonths}
              onChange={(e) => setFillAllMonths(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span>
              {language === 'ca'
                ? 'Copiar aquest mateix import als 12 mesos (de gener a desembre)'
                : 'Copiar este mismo importe en los 12 meses (de enero a diciembre)'}
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            {language === 'ca' ? 'Crear fila' : 'Crear fila'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
