import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Wallet,
  PiggyBank,
  ArrowRight,
  TrendingUp,
  Download,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Badge, ProgressBar, EmptyState, SkeletonTable } from '@/components/ui';
import { formatCurrency, distributeByPercentage, calculateBudgetStatus } from '@/lib/money';
import { getMonthName, getCurrentMonthYear, prevMonth, nextMonth } from '@/lib/dates';
import { AddMovementModal } from '@/components/modals/AddMovementModal';
import { AddIncomeModal } from '@/components/modals/AddIncomeModal';
import type { BudgetSection, IncomeEntry, Transaction } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

export function TreasuryPage() {
  const { user, settings } = useAuth();
  const { error: showError } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [{ month, year }, setMonthYear] = useState(getCurrentMonthYear());
  const [loading, setLoading] = useState(true);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showAddMovement, setShowAddMovement] = useState(searchParams.get('action') === 'add');
  const [showAddIncome, setShowAddIncome] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: inc }, { data: trans }] = await Promise.all([
        supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('budget_month', month)
          .eq('budget_year', year)
          .order('date', { ascending: false }),
        supabase
          .from('transactions')
          .select('*, category:categories(id, name, section)')
          .eq('user_id', user.id)
          .eq('budget_month', month)
          .eq('budget_year', year)
          .order('date', { ascending: false }),
      ]);
      setIncomes(inc ?? []);
      setTransactions(trans ?? []);
    } catch {
      showError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [user, month, year, showError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calculations
  const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const salaryIncome = incomes.filter((i) => i.income_type === 'salary').reduce((sum, i) => sum + i.amount, 0);
  const extraIncome = totalIncome - salaryIncome;

  const fp = settings?.fixed_percentage ?? 40;
  const lp = settings?.leisure_percentage ?? 30;
  const sp = settings?.savings_percentage ?? 30;

  let fixedBudget = 0, leisureBudget = 0, savingsBudget = 0;
  if (totalIncome > 0) {
    [fixedBudget, leisureBudget, savingsBudget] = distributeByPercentage(totalIncome, [fp, lp, sp]);
  }

  const expenses = transactions.filter((t) => t.type === 'expense');
  const fixedSpent = expenses.filter((t) => t.section === 'fixed').reduce((s, t) => s + t.amount, 0);
  const leisureSpent = expenses.filter((t) => t.section === 'leisure').reduce((s, t) => s + t.amount, 0);
  const savingsSpent = expenses.filter((t) => t.section === 'savings').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = fixedSpent + leisureSpent + savingsSpent;

  const sections: { key: BudgetSection; pct: number; budget: number; spent: number }[] = [
    { key: 'fixed', pct: fp, budget: fixedBudget, spent: fixedSpent },
    { key: 'leisure', pct: lp, budget: leisureBudget, spent: leisureSpent },
    { key: 'savings', pct: sp, budget: savingsBudget, spent: savingsSpent },
  ];

  const SECTION_ICONS: Record<BudgetSection, React.ReactNode> = {
    fixed: <Receipt className="h-4 w-4" />,
    leisure: <Wallet className="h-4 w-4" />,
    savings: <PiggyBank className="h-4 w-4" />,
  };

  const goToPrevMonth = () => setMonthYear(prevMonth(month, year));
  const goToNextMonth = () => setMonthYear(nextMonth(month, year));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            Hoja de tesorería
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400" aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-surface-700 dark:text-surface-300 min-w-[140px] text-center">
              {getMonthName(month)} {year}
            </span>
            <button onClick={goToNextMonth} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400" aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<TrendingUp className="h-4 w-4" />} onClick={() => setShowAddIncome(true)}>
            Añadir ingreso
          </Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddMovement(true)}>
            Añadir movimiento
          </Button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ingresos', value: totalIncome, color: 'text-success-600 dark:text-success-400' },
          { label: 'Gastos', value: totalExpenses, color: 'text-danger-600 dark:text-danger-400' },
          { label: 'Disponible', value: totalIncome - totalExpenses, color: totalIncome - totalExpenses >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600' },
          { label: 'Ahorro', value: savingsBudget - savingsSpent, color: 'text-savings-600 dark:text-savings-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl p-3 sm:p-4">
            <p className="text-xs text-surface-500 mb-1">{label}</p>
            <p className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${color}`}>
              {formatCurrency(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Income breakdown */}
      {incomes.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">Ingresos del mes</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowAddIncome(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
            </Button>
          </div>
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {incomes.map((inc) => (
              <div key={inc.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100">{inc.description}</p>
                  <p className="text-xs text-surface-400">{inc.income_type === 'salary' ? 'Nómina' : inc.income_type}</p>
                </div>
                <span className="text-sm font-mono font-semibold text-success-600 dark:text-success-400 tabular-nums">
                  +{formatCurrency(inc.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Treasury table */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="treasury-table">
            <thead>
              <tr>
                <th className="min-w-[180px]">Apartado</th>
                <th className="text-right w-20">%</th>
                <th className="text-right min-w-[110px]">Presupuesto</th>
                <th className="text-right min-w-[110px]">Gastado</th>
                <th className="text-right min-w-[110px]">Disponible</th>
                <th className="min-w-[120px]">Consumido</th>
                <th className="text-center w-20">Estado</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8}>
                    <SkeletonTable rows={3} />
                  </td>
                </tr>
              ) : (
                sections.map(({ key, pct, budget, spent }) => {
                  const status = calculateBudgetStatus(budget, spent);
                  const available = budget - spent;
                  const statusBadge = {
                    ok: { label: 'OK', variant: 'success' as const },
                    warning: { label: 'Atención', variant: 'warning' as const },
                    danger: { label: 'Crítico', variant: 'danger' as const },
                    over: { label: 'Excedido', variant: 'danger' as const },
                  }[status.status];

                  return (
                    <tr key={key} className="group">
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-surface-400">{SECTION_ICONS[key]}</span>
                          <span className="font-medium text-surface-900 dark:text-surface-100">
                            {BUDGET_SECTION_LABELS[key]}
                          </span>
                        </div>
                      </td>
                      <td className="amount-cell">{pct}%</td>
                      <td className="amount-cell font-mono tabular-nums">{formatCurrency(budget)}</td>
                      <td className="amount-cell font-mono tabular-nums amount-negative">{formatCurrency(spent)}</td>
                      <td className={`amount-cell font-mono tabular-nums font-semibold ${available >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                        {formatCurrency(available)}
                      </td>
                      <td>
                        <ProgressBar value={spent} max={budget || 1} size="sm" />
                      </td>
                      <td className="text-center">
                        <Badge variant={statusBadge.variant} size="sm">{statusBadge.label}</Badge>
                      </td>
                      <td>
                        <button
                          onClick={() => navigate(`/treasury/section/${key}?month=${month}&year=${year}`)}
                          className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 dark:hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-all"
                          aria-label={`Ver detalle de ${BUDGET_SECTION_LABELS[key]}`}
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && (
              <tfoot>
                <tr className="bg-surface-50 dark:bg-surface-800/50">
                  <td className="font-semibold text-surface-900 dark:text-surface-100">Total</td>
                  <td className="amount-cell font-semibold">100%</td>
                  <td className="amount-cell font-mono tabular-nums font-semibold">{formatCurrency(totalIncome)}</td>
                  <td className="amount-cell font-mono tabular-nums font-semibold amount-negative">{formatCurrency(totalExpenses)}</td>
                  <td className={`amount-cell font-mono tabular-nums font-bold ${totalIncome - totalExpenses >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {formatCurrency(totalIncome - totalExpenses)}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Recent expenses this month */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
            Movimientos del mes
          </h3>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/history?month=${month}&year=${year}`)}>
            Ver todos <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sin movimientos"
            description="Registra tu primer gasto o ingreso para empezar."
            action={
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowAddMovement(true)}>
                Añadir movimiento
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800 max-h-80 overflow-y-auto">
            {expenses.slice(0, 15).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2.5 hover:bg-surface-50 dark:hover:bg-surface-800/50 -mx-2 px-2 rounded-lg transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">{t.description}</p>
                  <p className="text-xs text-surface-400">
                    {t.category?.name ?? BUDGET_SECTION_LABELS[t.section as BudgetSection]}
                  </p>
                </div>
                <span className="text-sm font-mono font-semibold text-danger-600 dark:text-danger-400 tabular-nums shrink-0 ml-3">
                  -{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <AddMovementModal
        open={showAddMovement}
        onOpenChange={setShowAddMovement}
        month={month}
        year={year}
        onSaved={loadData}
      />
      <AddIncomeModal
        open={showAddIncome}
        onOpenChange={setShowAddIncome}
        month={month}
        year={year}
        onSaved={loadData}
      />
    </div>
  );
}
