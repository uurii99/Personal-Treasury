import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
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
      showError('Introduce un nombre para el nuevo concepto');
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

      success('Fila añadida al Excel', `Se ha creado "${trimmedName}"`);
      setName('');
      setDefaultAmount('');
      setFillAllMonths(false);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      console.error(e);
      showError('Error al guardar la nueva fila');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Añadir nueva fila / concepto"
      description="Crea un nuevo concepto para registrar importes en tu hoja Excel anual."
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <Select
          label="¿En qué tabla quieres añadirlo?"
          value={targetTable}
          onChange={(e) => setTargetTable(e.target.value as 'income' | BudgetSection)}
          options={[
            { value: 'income', label: '🟢 1. Ingresos' },
            { value: 'fixed', label: '🔵 2. Gastos Fijos' },
            { value: 'leisure', label: '🟡 3. Ocio y Gastos Variables' },
            { value: 'savings', label: '🟣 4. Inversiones y Ahorro' },
          ]}
        />

        <Input
          label="Nombre del concepto o categoría"
          placeholder="Ej: Clases de inglés, Seguro de hogar, Fondos Indexados..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />

        <Input
          label="Importe mensual inicial (opcional)"
          placeholder="0,00"
          suffix="€"
          value={defaultAmount}
          onChange={(e) => setDefaultAmount(e.target.value)}
          hint="Puedes dejarlo en 0 y rellenar las celdas directamente en la tabla."
        />

        {defaultAmount.trim() !== '' && parseFloat(defaultAmount.replace(',', '.')) > 0 && (
          <label className="flex items-center gap-2 cursor-pointer text-xs text-surface-600 dark:text-surface-300">
            <input
              type="checkbox"
              checked={fillAllMonths}
              onChange={(e) => setFillAllMonths(e.target.checked)}
              className="rounded text-brand-600 focus:ring-brand-500"
            />
            <span>Copiar este mismo importe en los 12 meses (de enero a diciembre)</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Crear fila
          </Button>
        </div>
      </form>
    </Modal>
  );
}
