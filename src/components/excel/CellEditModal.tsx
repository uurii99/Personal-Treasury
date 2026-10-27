import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useCelebration } from '@/contexts/CelebrationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { eurosToCents, centsToEuros } from '@/lib/money';
import { getMonthName } from '@/lib/dates';
import { recordMovementInBank } from '@/lib/banks';
import type { BudgetSection } from '@/types';

export interface CellEditData {
  type: 'income' | 'expense';
  section?: BudgetSection;
  categoryId?: string;
  conceptName: string;
  month: number;
  year: number;
  currentAmountCents: number;
}

interface CellEditModalProps {
  data: CellEditData | null;
  onClose: () => void;
  onSaved: () => void;
}

function CellEditForm({
  data,
  onClose,
  onSaved,
}: {
  data: CellEditData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { triggerNominaCelebration } = useCelebration();
  const { language } = useLanguage();

  const [amountStr, setAmountStr] = useState(() => {
    const euros = centsToEuros(data.currentAmountCents);
    return euros === 0 ? '' : euros.toString().replace('.', ',');
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsedAmount = amountStr.trim()
        ? parseFloat(amountStr.replace(',', '.'))
        : 0;

      if (isNaN(parsedAmount) || parsedAmount < 0) {
        showError(language === 'ca' ? 'Introdueix un import vàlid major o igual a 0' : 'Introduce un importe válido mayor o igual a 0');
        setSaving(false);
        return;
      }

      const cents = eurosToCents(parsedAmount);

      if (data.type === 'income') {
        const { data: existing } = await supabase
          .from('income_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('budget_month', data.month)
          .eq('budget_year', data.year)
          .eq('description', data.conceptName)
          .limit(1);

        if (cents === 0) {
          if (existing && existing.length > 0) {
            await supabase
              .from('income_entries')
              .delete()
              .eq('id', existing[0].id);
          }
        } else if (existing && existing.length > 0) {
          await supabase
            .from('income_entries')
            .update({
              amount: cents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing[0].id);
        } else {
          await supabase.from('income_entries').insert({
            user_id: user.id,
            description: data.conceptName,
            amount: cents,
            income_type: data.conceptName.toUpperCase().includes('NÒMINA') ? 'salary' : 'other',
            budget_month: data.month,
            budget_year: data.year,
            date: `${data.year}-${String(data.month).padStart(2, '0')}-01`,
          });
        }
      } else {
        let query = supabase
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('budget_month', data.month)
          .eq('budget_year', data.year)
          .eq('type', 'expense');

        if (data.categoryId) {
          query = query.eq('category_id', data.categoryId);
        } else {
          query = query.eq('description', data.conceptName);
        }

        const { data: existing } = await query.limit(1);

        if (cents === 0) {
          if (existing && existing.length > 0) {
            await supabase
              .from('transactions')
              .delete()
              .eq('id', existing[0].id);
          }
        } else if (existing && existing.length > 0) {
          await supabase
            .from('transactions')
            .update({
              amount: cents,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing[0].id);
        } else {
          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'expense',
            amount: cents,
            description: data.conceptName,
            category_id: data.categoryId || null,
            section: data.section || 'fixed',
            budget_month: data.month,
            budget_year: data.year,
            date: `${data.year}-${String(data.month).padStart(2, '0')}-01`,
          });
        }
      }

      // Update banks automatically
      const deltaCents = cents - (data.currentAmountCents || 0);
      if (deltaCents !== 0) {
        recordMovementInBank(user.id, {
          type: data.type,
          amountCents: Math.abs(deltaCents),
          section: data.section,
          description: data.conceptName,
          operation: deltaCents > 0 ? 'add' : 'remove',
        });
      }

      // If Nómina entered or increased, trigger Donald Duck money GIF!
      const isNomina =
        data.type === 'income' &&
        (data.conceptName.toUpperCase().includes('NÒMINA') ||
          data.conceptName.toUpperCase().includes('NOMINA'));
      if (isNomina && cents > 0) {
        triggerNominaCelebration(cents);
      }

      success('Celda actualizada', `${data.conceptName} (${getMonthName(data.month)}): ${parsedAmount.toFixed(2)} €`);
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      showError('Error al guardar el valor de la celda');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <Input
        label={language === 'ca' ? 'Import (€)' : 'Importe (€)'}
        type="text"
        placeholder="0,00"
        value={amountStr}
        onChange={(e) => setAmountStr(e.target.value)}
        suffix="€"
        autoFocus
        hint={
          language === 'ca'
            ? "Si poses 0 o ho deixes buit, s'eliminarà el valor d'aquest mes."
            : 'Si pones 0 o lo dejas vacío, se eliminará el valor de este mes.'
        }
      />

      {/* Quick buttons */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {[20, 50, 100, 200, 500].map((amt) => (
          <button
            key={amt}
            type="button"
            onClick={() => setAmountStr(amt.toString())}
            className="text-xs px-2.5 py-1 rounded-md bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 transition-colors"
          >
            {amt} €
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmountStr('0')}
          className="text-xs px-2.5 py-1 rounded-md bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 hover:bg-danger-100 transition-colors"
        >
          {language === 'ca' ? 'Esborrar (0 €)' : 'Borrar (0 €)'}
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
        <Button variant="ghost" type="button" onClick={onClose}>
          {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
        </Button>
        <Button type="submit" loading={saving}>
          {language === 'ca' ? 'Guardar a la cel·la' : 'Guardar en celda'}
        </Button>
      </div>
    </form>
  );
}

export function CellEditModal({ data, onClose, onSaved }: CellEditModalProps) {
  const { language, t } = useLanguage();
  if (!data) return null;

  return (
    <Modal
      open={!!data}
      onOpenChange={(open) => !open && onClose()}
      title={language === 'ca' ? `Editar cel·la: ${data.conceptName}` : `Editar celda: ${data.conceptName}`}
      description={`${t.months[data.month - 1]} ${data.year} · ${data.type === 'income' ? (language === 'ca' ? 'Ingrés' : 'Ingreso') : (language === 'ca' ? 'Despesa' : 'Gasto')}`}
      size="sm"
    >
      <CellEditForm key={`${data.conceptName}-${data.month}-${data.year}`} data={data} onClose={onClose} onSaved={onSaved} />
    </Modal>
  );
}
