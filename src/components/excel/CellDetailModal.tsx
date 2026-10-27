import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, Edit2, Calendar, Building2, ArrowUpDown } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button, ConfirmDialog } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/money';
import { recordMovementInBank } from '@/lib/banks';
import { AddMovementModal, type MovementEditData } from '@/components/modals/AddMovementModal';
import { AddIncomeModal, type IncomeEditData } from '@/components/modals/AddIncomeModal';
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

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<'date-desc' | 'amount-desc' | 'amount-asc' | 'date-asc'>('date-desc');

  // Unified modal state for Gasto
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<MovementEditData | null>(null);

  // Unified modal state for Ingreso
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeEditData | null>(null);

  // Delete confirm dialog state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortBy === 'amount-desc') return (b.amount || 0) - (a.amount || 0);
      if (sortBy === 'amount-asc') return (a.amount || 0) - (b.amount || 0);
      if (sortBy === 'date-asc') return (a.date || '').localeCompare(b.date || '');
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [items, sortBy]);

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
      showError(language === 'ca' ? 'Error en carregar desglossament' : 'Error al cargar desglose');
    } finally {
      setLoading(false);
    }
  }, [user, target, showError, language]);

  useEffect(() => {
    if (target) {
      loadSubMovements();
    }
  }, [target, loadSubMovements]);

  if (!target) return null;

  const totalCents = items.reduce((acc, curr) => acc + (curr.amount || 0), 0);
  const monthName = t.months[target.month - 1];

  const getBankFromNotes = (notes: string | null) => {
    if (!notes) return '';
    try {
      if (notes.startsWith('{')) {
        const parsed = JSON.parse(notes);
        return parsed.bank || '';
      }
    } catch {}
    const known = ['banc sabadell', 'sabadell', 'revolut', 'trade republic', 'myinversor', 'myinvestor', 'efectivo', 'efectiu', 'caixabank', 'bbva', 'santander'];
    if (known.some((k) => notes.toLowerCase().includes(k))) {
      return notes;
    }
    return '';
  };

  const handleDeleteItem = async (id: string) => {
    if (!user || !target) return;
    const itemToDelete = items.find((it) => it.id === id);
    try {
      if (target.type === 'income') {
        await supabase.from('income_entries').delete().eq('id', id);
        if (itemToDelete) {
          recordMovementInBank(user.id, {
            amountCents: itemToDelete.amount,
            type: 'income',
            description: target.conceptName,
            operation: 'remove',
          });
        }
      } else {
        await supabase.from('transactions').delete().eq('id', id);
        if (itemToDelete) {
          recordMovementInBank(user.id, {
            amountCents: itemToDelete.amount,
            type: 'expense',
            section: target.section || 'fixed',
            description: itemToDelete.description || target.conceptName,
            operation: 'remove',
          });
        }
      }
      success(language === 'ca' ? 'Moviment eliminat' : 'Movimiento eliminado');
      await loadSubMovements();
      window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
      window.dispatchEvent(new CustomEvent('excel-data-updated'));
      onUpdated();
    } catch {
      showError(language === 'ca' ? 'Error en eliminar el moviment' : 'Error al eliminar el movimiento');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const handleStartEdit = (item: any) => {
    if (target.type === 'expense') {
      setEditingMovement({
        id: item.id,
        amountCents: item.amount,
        date: item.date,
        section: target.section || item.section || 'fixed',
        categoryId: target.categoryId || item.category_id,
        description: item.description,
      });
      setMovementModalOpen(true);
    } else {
      const bankName = getBankFromNotes(item.notes);
      let customDesc = item.description;
      if (item.notes && item.notes.startsWith('{')) {
        try {
          const parsed = JSON.parse(item.notes);
          if (parsed.rawConcept || parsed.description) customDesc = parsed.rawConcept || parsed.description;
        } catch {}
      }
      const isSal =
        item.income_type === 'salary' ||
        target.conceptName.toUpperCase().includes('NÓMINA') ||
        target.conceptName.toUpperCase().includes('NOMINA');

      setEditingIncome({
        id: item.id,
        income_type: isSal ? 'salary' : 'other',
        amountCents: item.amount,
        date: item.date,
        description: customDesc,
        bank: bankName,
      });
      setIncomeModalOpen(true);
    }
  };

  const handleOpenAddForm = () => {
    if (target.type === 'expense') {
      setEditingMovement(null);
      setMovementModalOpen(true);
    } else {
      setEditingIncome(null);
      setIncomeModalOpen(true);
    }
  };

  const handleModalSaved = async () => {
    await loadSubMovements();
    window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
    window.dispatchEvent(new CustomEvent('excel-data-updated'));
    onUpdated();
  };

  return (
    <>
      <Modal
        open={Boolean(target)}
        onOpenChange={(open) => !open && onClose()}
        title={`${target.conceptName} — ${monthName} ${target.year}`}
        description={
          target.type === 'income'
            ? language === 'ca' ? 'Desglossament detallat dels ingressos d\'aquest concepte' : 'Desglose detallado de los ingresos de este concepto'
            : language === 'ca' ? 'Desglossament detallat de les despeses d\'aquesta categoria' : 'Desglose detallado de los gastos de esta categoría'
        }
        size="lg"
      >
        <div className="space-y-4">
          {/* Header KPI chip */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-surface-50 dark:bg-surface-800/60 rounded-xl border border-surface-200 dark:border-surface-700">
            <div>
              <p className="text-xs text-surface-500 font-medium">
                {language === 'ca' ? 'Total registrat al mes:' : 'Total registrado en el mes:'}
              </p>
              <p className="text-xl font-mono font-extrabold text-surface-900 dark:text-surface-100 tabular-nums">
                {formatCurrency(totalCents)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleOpenAddForm}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>
                  {target.type === 'income'
                    ? language === 'ca' ? 'Afegir Ingrés' : 'Añadir Ingreso'
                    : language === 'ca' ? 'Afegir Gasto' : 'Añadir Gasto'}
                </span>
              </Button>
            </div>
          </div>

          {/* List Toolbar: Sort & Count */}
          <div className="flex items-center justify-between gap-2 text-xs text-surface-500">
            <span className="font-semibold">
              {items.length} {items.length === 1 ? (language === 'ca' ? 'moviment' : 'movimiento') : (language === 'ca' ? 'moviments' : 'movimientos')}
            </span>

            <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 p-0.5 rounded-lg border border-surface-200 dark:border-surface-700">
              <span className="px-1.5 text-[11px] font-semibold text-surface-400 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
              </span>
              <button
                type="button"
                onClick={() => setSortBy('date-desc')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  sortBy === 'date-desc'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-xs font-bold'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                {language === 'ca' ? 'Data ↓' : 'Fecha ↓'}
              </button>
              <button
                type="button"
                onClick={() => setSortBy('amount-desc')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  sortBy === 'amount-desc'
                    ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-xs font-bold'
                    : 'text-surface-500 hover:text-surface-900'
                }`}
              >
                {language === 'ca' ? 'Import ↓' : 'Importe ↓'}
              </button>
            </div>
          </div>

          {/* Items List */}
          {loading ? (
            <div className="p-8 text-center text-xs text-surface-400">
              {language === 'ca' ? 'Carregant desglossament...' : 'Cargando desglose...'}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-dashed border-surface-200 dark:border-surface-700 text-surface-400 text-xs space-y-2">
              <p>
                {language === 'ca'
                  ? 'No hi ha moviments registrats per a aquest mes encara.'
                  : 'No hay movimientos registrados para este mes todavía.'}
              </p>
              <Button size="sm" variant="outline" onClick={handleOpenAddForm}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                {target.type === 'income'
                  ? language === 'ca' ? 'Registrar ingrés' : 'Registrar ingreso'
                  : language === 'ca' ? 'Registrar despesa' : 'Registrar gasto'}
              </Button>
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-surface-100 dark:divide-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl bg-white dark:bg-surface-900 overflow-hidden shadow-sm">
              {sortedItems.map((item) => {
                const bankName = getBankFromNotes(item.notes);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-surface-900 dark:text-surface-100 truncate">
                        {(() => {
                          if (item.notes && item.notes.startsWith('{')) {
                            try {
                              const parsed = JSON.parse(item.notes);
                              if (parsed.rawConcept) return parsed.rawConcept;
                              if (parsed.description) return parsed.description;
                            } catch {}
                          }
                          return item.description;
                        })()}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-surface-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {item.date}
                        </span>
                        {bankName && (
                          <>
                            <span>·</span>
                            <span className="flex items-center gap-1 font-medium text-surface-600 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded-md">
                              <Building2 className="h-3 w-3" /> {bankName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono font-bold text-sm tabular-nums text-surface-900 dark:text-surface-100">
                        {formatCurrency(item.amount)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                          title={language === 'ca' ? 'Editar' : 'Editar'}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          className="p-1.5 rounded-lg text-danger-400 hover:text-danger-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title={language === 'ca' ? 'Eliminar' : 'Eliminar'}
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

          <div className="flex items-center justify-between pt-3 border-t border-surface-200 dark:border-surface-700">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAddForm}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                {target.type === 'income'
                  ? language === 'ca' ? 'Nou Ingrés' : 'Nuevo Ingreso'
                  : language === 'ca' ? 'Nova Despesa' : 'Nuevo Gasto'}
              </span>
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {language === 'ca' ? 'Tancar desglossament' : 'Cerrar desglose'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unified Add/Edit Gasto Modal */}
      {movementModalOpen && (
        <AddMovementModal
          open={movementModalOpen}
          onOpenChange={setMovementModalOpen}
          month={target?.month}
          year={target?.year}
          defaultSection={target?.section}
          defaultCategoryId={target?.categoryId}
          initialData={editingMovement}
          onSaved={handleModalSaved}
        />
      )}

      {/* Unified Add/Edit Ingreso Modal */}
      {incomeModalOpen && (
        <AddIncomeModal
          open={incomeModalOpen}
          onOpenChange={setIncomeModalOpen}
          month={target?.month}
          year={target?.year}
          defaultType={
            target?.conceptName.toUpperCase().includes('NÓMINA') ||
            target?.conceptName.toUpperCase().includes('NOMINA')
              ? 'salary'
              : 'extra'
          }
          initialData={editingIncome}
          onSaved={handleModalSaved}
        />
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
        title={language === 'ca' ? 'Eliminar moviment' : 'Eliminar movimiento'}
        description={
          language === 'ca'
            ? 'Segur que vols eliminar aquest moviment? L\'import es descomptarà automàticament de la categoria i dels bancs.'
            : '¿Seguro que quieres eliminar este movimiento? El importe se descontará automáticamente de la categoría y de los bancos.'
        }
        confirmLabel={language === 'ca' ? 'Eliminar' : 'Eliminar'}
        cancelLabel={language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
        variant="danger"
        onConfirm={() => {
          if (confirmDeleteId) handleDeleteItem(confirmDeleteId);
        }}
      />
    </>
  );
}
