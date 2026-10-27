import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Edit2, Calendar, Building2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button, Input, Select } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, eurosToCents, centsToEuros } from '@/lib/money';
import { getBankAccounts, recordMovementInBank } from '@/lib/banks';
import { useCelebration } from '@/contexts/CelebrationContext';
import type { BudgetSection } from '@/types';

export interface CellDetailTarget {
  type: 'income' | 'expense';
  section?: BudgetSection;
  categoryId?: string;
  conceptName: string;
  month: number;
  year: number;
}

interface CellDetailModalProps {
  target: CellDetailTarget | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function CellDetailModal({ target, onClose, onUpdated }: CellDetailModalProps) {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { language, t } = useLanguage();
  const { triggerNominaCelebration } = useCelebration();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // Add sub-expense form
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [bank, setBank] = useState('Banc Sabadell');
  const [dateStr, setDateStr] = useState('');
  const [savingSubItem, setSavingSubItem] = useState(false);

  // Edit sub-expense form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAmountStr, setEditAmountStr] = useState('');
  const [editBank, setEditBank] = useState('');

  // Available banks
  const bankAccounts = user ? getBankAccounts(user.id) : [];

  const loadSubMovements = useCallback(async () => {
    if (!user || !target) return;
    setLoading(true);

    try {
      if (target.type === 'income') {
        const { data, error } = await supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('budget_month', target.month)
          .eq('budget_year', target.year)
          .eq('description', target.conceptName)
          .order('date', { ascending: false });

        if (error) throw error;
        setItems(data ?? []);
      } else {
        // Query transactions for this category or concept
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .eq('budget_month', target.month)
          .eq('budget_year', target.year)
          .eq('type', 'expense');

        if (target.categoryId) {
          query = query.eq('category_id', target.categoryId);
        } else {
          query = query.eq('description', target.conceptName);
        }

        const { data, error } = await query.order('date', { ascending: false });
        if (error) throw error;
        setItems(data ?? []);
      }
    } catch (e) {
      console.error('Error loading movements:', e);
      showError('Error al cargar movimientos detallados');
    } finally {
      setLoading(false);
    }
  }, [user, target, showError]);

  useEffect(() => {
    if (target) {
      loadSubMovements();
      const defaultDay = '01';
      setDateStr(`${target.year}-${String(target.month).padStart(2, '0')}-${defaultDay}`);
    }
  }, [target, loadSubMovements]);

  if (!target) return null;

  const totalCents = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const monthName = t.months[target.month - 1];

  // Helper to get bank name from notes JSON or string
  const getBankFromNotes = (notes: string | null) => {
    if (!notes) return 'Banc Sabadell';
    try {
      if (notes.startsWith('{')) {
        const parsed = JSON.parse(notes);
        return parsed.bank || 'Banc Sabadell';
      }
      return notes;
    } catch {
      return notes;
    }
  };

  const handleAddSubMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !target) return;

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      showError('Introduce una descripción (ej. sushi cena, desayuno ruta moto...)');
      return;
    }

    const parsed = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      showError('Introduce un importe válido mayor a 0');
      return;
    }

    setSavingSubItem(true);
    try {
      const cents = eurosToCents(parsed);
      const notesObj = JSON.stringify({ bank: bank });

      if (target.type === 'income') {
        const { error } = await supabase.from('income_entries').insert({
          user_id: user.id,
          description: target.conceptName,
          amount: cents,
          income_type: target.conceptName.toUpperCase().includes('NÓMINA') ? 'salary' : 'other',
          budget_month: target.month,
          budget_year: target.year,
          date: dateStr || `${target.year}-${String(target.month).padStart(2, '0')}-01`,
          notes: notesObj,
        });
        if (error) throw error;

        // Auto-update banks:
        recordMovementInBank(user.id, {
          amount: cents,
          type: 'income',
          concept: target.conceptName,
          bank,
        });

        if (target.conceptName.toUpperCase().includes('NÓMINA') || target.conceptName.toUpperCase().includes('NOMINA')) {
          triggerNominaCelebration(cents);
        }
      } else {
        const { error } = await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'expense',
          amount: cents,
          description: trimmedDesc,
          category_id: target.categoryId || null,
          section: target.section || 'fixed',
          budget_month: target.month,
          budget_year: target.year,
          date: dateStr || `${target.year}-${String(target.month).padStart(2, '0')}-01`,
          notes: notesObj,
        });
        if (error) throw error;

        // Auto-update banks:
        recordMovementInBank(user.id, {
          amount: cents,
          type: 'expense',
          concept: trimmedDesc || target.conceptName,
          bank,
        });
      }

      success('Movimiento registrado', `${trimmedDesc} (${parsed.toFixed(2)} €)`);
      setDescription('');
      setAmountStr('');
      await loadSubMovements();
      window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
      onUpdated();
    } catch (err) {
      console.error('Error saving movement:', err);
      showError('Error al guardar el movimiento');
    } finally {
      setSavingSubItem(false);
    }
  };

  const handleDeleteSubMovement = async (id: string) => {
    if (!user || !target) return;
    const itemToDelete = items.find((it) => it.id === id);
    try {
      if (target.type === 'income') {
        await supabase.from('income_entries').delete().eq('id', id);
        if (itemToDelete) {
          recordMovementInBank(user.id, {
            amount: itemToDelete.amount,
            type: 'expense', // Reverting income decreases bank
            concept: target.conceptName,
            bank: getBankFromNotes(itemToDelete.notes),
          });
        }
      } else {
        await supabase.from('transactions').delete().eq('id', id);
        if (itemToDelete) {
          recordMovementInBank(user.id, {
            amount: itemToDelete.amount,
            type: 'income', // Reverting expense increases bank
            concept: itemToDelete.description || target.conceptName,
            bank: getBankFromNotes(itemToDelete.notes),
          });
        }
      }
      success('Movimiento eliminado');
      await loadSubMovements();
      window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
      onUpdated();
    } catch {
      showError('Error al eliminar');
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditDesc(item.description);
    setEditAmountStr(centsToEuros(item.amount).toString().replace('.', ','));
    setEditBank(getBankFromNotes(item.notes));
  };

  const handleSaveEdit = async (id: string) => {
    if (!user || !target) return;
    const parsed = parseFloat(editAmountStr.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      showError('Importe inválido');
      return;
    }

    const oldItem = items.find((it) => it.id === id);
    try {
      const cents = eurosToCents(parsed);
      const notesObj = JSON.stringify({ bank: editBank });

      if (target.type === 'income') {
        await supabase
          .from('income_entries')
          .update({
            amount: cents,
            notes: notesObj,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (oldItem) {
          const delta = cents - (oldItem.amount || 0);
          if (delta !== 0) {
            recordMovementInBank(user.id, {
              amount: Math.abs(delta),
              type: delta > 0 ? 'income' : 'expense',
              concept: target.conceptName,
              bank: editBank,
            });
          }
        }
      } else {
        await supabase
          .from('transactions')
          .update({
            description: editDesc.trim(),
            amount: cents,
            notes: notesObj,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (oldItem) {
          const delta = cents - (oldItem.amount || 0);
          if (delta !== 0) {
            recordMovementInBank(user.id, {
              amount: Math.abs(delta),
              type: delta > 0 ? 'expense' : 'income',
              concept: editDesc.trim() || target.conceptName,
              bank: editBank,
            });
          }
        }
      }

      success('Movimiento actualizado');
      setEditingId(null);
      await loadSubMovements();
      window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
      onUpdated();
    } catch {
      showError('Error al actualizar');
    }
  };

  return (
    <Modal
      open={!!target}
      onOpenChange={(open) => !open && onClose()}
      title={language === 'ca' ? `Desglossament: ${target.conceptName}` : `Desglose: ${target.conceptName}`}
      description={`${monthName} ${target.year} · ${language === 'ca' ? 'Suma total del concepte' : 'Suma total del concepto'}`}
      size="lg"
    >
      <div className="space-y-6">
        {/* Banner with Total */}
        <div className="bg-gradient-to-r from-surface-100 via-surface-50 to-surface-100 dark:from-surface-800 dark:via-surface-850 dark:to-surface-800 p-4 rounded-2xl border border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-surface-500">
              {language === 'ca' ? `Total a la cel·la (${monthName})` : `Total en celda (${monthName})`}
            </span>
            <p className="text-2xl font-bold font-mono tabular-nums text-surface-900 dark:text-surface-100">
              {formatCurrency(totalCents)}
            </p>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full bg-surface-200 dark:bg-surface-700 font-mono text-surface-700 dark:text-surface-300">
            {items.length} {items.length === 1 ? (language === 'ca' ? 'moviment' : 'movimiento') : (language === 'ca' ? 'moviments' : 'movimientos')}
          </span>
        </div>

        {/* List of individual movements */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-surface-500 block">
            {language === 'ca' ? 'Moviments que componen aquest import' : 'Movimientos que componen este importe'}
          </label>

          {loading ? (
            <div className="p-8 text-center text-xs text-surface-400">
              {language === 'ca' ? 'Carregant desglossament...' : 'Cargando desglose...'}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center rounded-xl border border-dashed border-surface-200 dark:border-surface-700 text-surface-400 text-xs">
              {language === 'ca'
                ? 'No hi ha moviments registrats per a aquest mes encara. Afegeix-ne un a sota.'
                : 'No hay movimientos registrados para este mes todavía. Añade uno abajo.'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
              {items.map((item) => {
                const isEditing = editingId === item.id;
                const bankName = getBankFromNotes(item.notes);

                if (isEditing) {
                  return (
                    <div key={item.id} className="p-3 bg-brand-50/40 dark:bg-brand-950/20 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Descripción"
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                        />
                        <Input
                          placeholder="Importe €"
                          value={editAmountStr}
                          onChange={(e) => setEditAmountStr(e.target.value)}
                          suffix="€"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Select
                          value={editBank}
                          onChange={(e) => setEditBank(e.target.value)}
                          options={[
                            { value: 'Banc Sabadell', label: 'Banc Sabadell' },
                            { value: 'Revolut', label: 'Revolut' },
                            { value: 'Trade Republic', label: 'Trade Republic' },
                            { value: 'MyInversor', label: 'MyInversor' },
                            { value: 'Efectivo', label: 'Efectivo' },
                          ]}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
                          </Button>
                          <Button size="sm" onClick={() => handleSaveEdit(item.id)}>
                            {language === 'ca' ? 'Guardar' : 'Guardar'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.id}
                    className="p-3 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {item.date}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400">
                          <Building2 className="h-3 w-3" /> {bankName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono font-bold text-sm tabular-nums text-surface-900 dark:text-surface-100">
                        {formatCurrency(item.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="p-1 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSubMovement(item.id)}
                          className="p-1 rounded text-danger-400 hover:text-danger-600"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Add Form: "+ Añadir movimiento a esta categoría" */}
        <form
          onSubmit={handleAddSubMovement}
          className="bg-surface-50 dark:bg-surface-800/40 p-4 rounded-2xl border border-surface-200 dark:border-surface-700 space-y-3"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
            <Plus className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              {language === 'ca'
                ? `Afegir nou ${target.type === 'income' ? 'ingrés' : 'despesa'} a ${target.conceptName}`
                : `Añadir nuevo ${target.type === 'income' ? 'ingreso' : 'gasto'} a ${target.conceptName}`}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={language === 'ca' ? 'Descripció detallada' : 'Descripción detallada'}
              placeholder={
                language === 'ca'
                  ? 'Ex: sopar sushi, esmorzar ruta moto...'
                  : 'Ej: sushi cena amor, desayuno ruta moto...'
              }
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Input
              label={language === 'ca' ? 'Import (€)' : 'Importe (€)'}
              placeholder="0,00"
              suffix="€"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={language === 'ca' ? 'Banc de procedència' : 'Banco de procedencia'}
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              options={
                bankAccounts.length > 0
                  ? bankAccounts.map((b) => ({ value: b.name, label: b.name }))
                  : [
                      { value: 'Banc Sabadell', label: 'Banc Sabadell' },
                      { value: 'Revolut', label: 'Revolut' },
                      { value: 'Trade Republic', label: 'Trade Republic' },
                      { value: 'MyInversor', label: 'MyInversor' },
                      { value: 'Efectivo', label: language === 'ca' ? 'Efectiu' : 'Efectivo' },
                    ]
              }
            />
            <Input
              label={language === 'ca' ? 'Data' : 'Fecha'}
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" loading={savingSubItem} icon={<Plus className="h-4 w-4" />}>
              {language === 'ca' ? `Afegir a ${target.conceptName}` : `Añadir a ${target.conceptName}`}
            </Button>
          </div>
        </form>

        <div className="flex justify-end pt-2 border-t border-surface-200 dark:border-surface-700">
          <Button variant="ghost" onClick={onClose}>
            {language === 'ca' ? 'Tancar desglossament' : 'Cerrar desglose'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
