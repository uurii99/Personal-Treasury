import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, Receipt, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, ProgressBar, EmptyState, ConfirmDialog, Input } from '@/components/ui';
import { formatCurrency, distributeByPercentage, centsToEuros } from '@/lib/money';
import { getMonthName, formatDateShort, getCurrentMonthYear } from '@/lib/dates';
import type { BudgetSection, Transaction, Category } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

export function SectionDetailPage() {
  const { section } = useParams<{ section: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, settings } = useAuth();
  const { success, error: showError } = useToast();

  const month = parseInt(searchParams.get('month') ?? '') || getCurrentMonthYear().month;
  const year = parseInt(searchParams.get('year') ?? '') || getCurrentMonthYear().year;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const sectionKey = section as BudgetSection;
  const sectionLabel = BUDGET_SECTION_LABELS[sectionKey] ?? section;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: trans }, { data: incomes }, { data: cats }] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(id, name, section)')
          .eq('user_id', user.id)
          .eq('section', sectionKey)
          .eq('budget_month', month)
          .eq('budget_year', year)
          .order('date', { ascending: false }),
        supabase
          .from('income_entries')
          .select('amount')
          .eq('user_id', user.id)
          .eq('budget_month', month)
          .eq('budget_year', year),
        supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id)
          .eq('section', sectionKey)
          .eq('is_archived', false),
      ]);

      setTransactions(trans ?? []);
      setCategories(cats ?? []);
      const total = (incomes ?? []).reduce((s, i) => s + i.amount, 0);
      setTotalIncome(total);
    } catch {
      showError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [user, sectionKey, month, year, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Budget calculation
  const percentages: Record<BudgetSection, number> = {
    fixed: settings?.fixed_percentage ?? 40,
    leisure: settings?.leisure_percentage ?? 30,
    savings: settings?.savings_percentage ?? 30,
  };

  let sectionBudget = 0;
  if (totalIncome > 0) {
    const [fb, lb, sb] = distributeByPercentage(totalIncome, [
      percentages.fixed,
      percentages.leisure,
      percentages.savings,
    ]);
    const budgets: Record<BudgetSection, number> = { fixed: fb, leisure: lb, savings: sb };
    sectionBudget = budgets[sectionKey];
  }

  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const available = sectionBudget - totalSpent;
  const pctUsed = sectionBudget > 0 ? (totalSpent / sectionBudget) * 100 : 0;

  // Category breakdown
  const categoryBreakdown = categories.map((cat) => {
    const catExpenses = expenses.filter((t) => t.category_id === cat.id);
    const catTotal = catExpenses.reduce((s, t) => s + t.amount, 0);
    return { ...cat, total: catTotal, count: catExpenses.length };
  }).filter((c) => c.total > 0 || c.count > 0).sort((a, b) => b.total - a.total);

  // Filter transactions
  const filtered = searchQuery
    ? transactions.filter((t) =>
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : transactions;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteTarget);
      if (error) {
        showError('Error al eliminar');
      } else {
        success('Movimiento eliminado');
        loadData();
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            {sectionLabel}
          </h1>
          <p className="text-sm text-surface-500">
            {getMonthName(month)} {year} · {percentages[sectionKey]}% del presupuesto
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="sm">
          <p className="text-xs text-surface-500 mb-1">Presupuesto</p>
          <p className="text-lg font-bold font-mono tabular-nums text-surface-900 dark:text-surface-100">
            {formatCurrency(sectionBudget)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-surface-500 mb-1">Gastado</p>
          <p className="text-lg font-bold font-mono tabular-nums text-danger-600 dark:text-danger-400">
            {formatCurrency(totalSpent)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-surface-500 mb-1">Disponible</p>
          <p className={`text-lg font-bold font-mono tabular-nums ${available >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
            {formatCurrency(available)}
          </p>
        </Card>
        <Card padding="sm">
          <p className="text-xs text-surface-500 mb-1">Consumido</p>
          <ProgressBar value={totalSpent} max={sectionBudget || 1} size="md" showLabel />
        </Card>
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
            Desglose por categoría
          </h3>
          <div className="space-y-2">
            {categoryBreakdown.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-surface-700 dark:text-surface-300 truncate">{cat.name}</span>
                  <Badge size="sm">{cat.count}</Badge>
                </div>
                <span className="text-sm font-mono font-semibold text-surface-900 dark:text-surface-100 tabular-nums">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Transactions list */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Movimientos ({filtered.length})
          </h3>
          <div className="w-48">
            <Input
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sin movimientos"
            description={searchQuery ? 'No se encontraron resultados.' : 'No hay movimientos en este apartado.'}
          />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {filtered.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3 group">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                    {t.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-surface-400">{formatDateShort(t.date)}</span>
                    {t.category?.name && (
                      <Badge size="sm">{t.category.name}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <span className={`text-sm font-mono font-semibold tabular-nums ${
                    t.type === 'expense' ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'
                  }`}>
                    {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                  </span>
                  <button
                    onClick={() => setDeleteTarget(t.id)}
                    className="p-1 rounded text-surface-300 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Eliminar movimiento"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Eliminar movimiento"
        description="¿Seguro que quieres eliminar este movimiento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
