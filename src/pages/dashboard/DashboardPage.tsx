import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ArrowRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Target,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, Button, Badge, ProgressBar, EmptyState, SkeletonCard } from '@/components/ui';
import { formatCurrency, distributeByPercentage, calculateBudgetStatus } from '@/lib/money';
import { getMonthName, getCurrentMonthYear, prevMonth, nextMonth } from '@/lib/dates';
import type { BudgetSection, MonthlySummary } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

const SECTION_ICONS: Record<BudgetSection, React.ReactNode> = {
  fixed: <Receipt className="h-5 w-5" />,
  leisure: <Wallet className="h-5 w-5" />,
  savings: <PiggyBank className="h-5 w-5" />,
};

const SECTION_BADGE_VARIANT: Record<BudgetSection, 'info' | 'warning' | 'savings'> = {
  fixed: 'info',
  leisure: 'warning',
  savings: 'savings',
};

export function DashboardPage() {
  const { user, settings } = useAuth();
  const navigate = useNavigate();
  const [{ month, year }, setMonthYear] = useState(getCurrentMonthYear());
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    if (!user || !settings) return;
    setLoading(true);

    try {
      // Fetch income for the month
      const { data: incomes } = await supabase
        .from('income_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('budget_month', month)
        .eq('budget_year', year);

      // Fetch transactions for the month
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*, category:categories(name, section)')
        .eq('user_id', user.id)
        .eq('budget_month', month)
        .eq('budget_year', year)
        .order('date', { ascending: false });

      // Fetch transfers for the month
      const { data: transfers } = await supabase
        .from('budget_transfers')
        .select('*')
        .eq('user_id', user.id)
        .eq('budget_month', month)
        .eq('budget_year', year);

      // Calculate totals
      const totalIncome = (incomes ?? []).reduce((sum, i) => sum + i.amount, 0);
      const salaryIncome = (incomes ?? []).filter((i) => i.income_type === 'salary').reduce((sum, i) => sum + i.amount, 0);
      const extraIncome = totalIncome - salaryIncome;

      const allTransactions = transactions ?? [];
      const expenseTransactions = allTransactions.filter((t) => t.type === 'expense');

      const fixedExpenses = expenseTransactions.filter((t) => t.section === 'fixed').reduce((sum, t) => sum + t.amount, 0);
      const leisureExpenses = expenseTransactions.filter((t) => t.section === 'leisure').reduce((sum, t) => sum + t.amount, 0);
      const savingsContributions = expenseTransactions.filter((t) => t.section === 'savings').reduce((sum, t) => sum + t.amount, 0);
      const totalExpenses = fixedExpenses + leisureExpenses + savingsContributions;

      // Calculate transfers net effect per section
      const allTransfers = transfers ?? [];
      const transferNet: Record<BudgetSection, number> = { fixed: 0, leisure: 0, savings: 0 };
      allTransfers.forEach((t) => {
        transferNet[t.from_section as BudgetSection] -= t.amount;
        transferNet[t.to_section as BudgetSection] += t.amount;
      });

      // Distribute income by percentages
      let fixedBudget = 0, leisureBudget = 0, savingsBudget = 0;
      if (totalIncome > 0) {
        const [fb, lb, sb] = distributeByPercentage(totalIncome, [
          settings.fixed_percentage,
          settings.leisure_percentage,
          settings.savings_percentage,
        ]);
        fixedBudget = fb;
        leisureBudget = lb;
        savingsBudget = sb;
      }

      // Apply transfers
      fixedBudget += transferNet.fixed;
      leisureBudget += transferNet.leisure;
      savingsBudget += transferNet.savings;

      const fixedAvailable = fixedBudget - fixedExpenses;
      const leisureAvailable = leisureBudget - leisureExpenses;
      const savingsAvailable = savingsBudget - savingsContributions;

      setSummary({
        totalIncome,
        salaryIncome,
        extraIncome,
        totalExpenses,
        fixedExpenses,
        leisureExpenses,
        savingsContributions,
        fixedBudget,
        leisureBudget,
        savingsBudget,
        fixedAvailable,
        leisureAvailable,
        savingsAvailable,
        totalAvailable: fixedAvailable + leisureAvailable + savingsAvailable,
        totalSaved: savingsAvailable,
      });

      setRecentTransactions(allTransactions.slice(0, 5));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, settings, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goToPrevMonth = () => {
    const p = prevMonth(month, year);
    setMonthYear(p);
  };

  const goToNextMonth = () => {
    const n = nextMonth(month, year);
    setMonthYear(n);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  const s = summary ?? {
    totalIncome: 0, salaryIncome: 0, extraIncome: 0, totalExpenses: 0,
    fixedExpenses: 0, leisureExpenses: 0, savingsContributions: 0,
    fixedBudget: 0, leisureBudget: 0, savingsBudget: 0,
    fixedAvailable: 0, leisureAvailable: 0, savingsAvailable: 0,
    totalAvailable: 0, totalSaved: 0,
  };

  const sectionData: { key: BudgetSection; budget: number; spent: number }[] = [
    { key: 'fixed', budget: s.fixedBudget, spent: s.fixedExpenses },
    { key: 'leisure', budget: s.leisureBudget, spent: s.leisureExpenses },
    { key: 'savings', budget: s.savingsBudget, spent: s.savingsContributions },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            Dashboard
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400" aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium text-surface-600 dark:text-surface-400 min-w-[140px] text-center">
              {getMonthName(month)} {year}
            </span>
            <button onClick={goToNextMonth} className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400" aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/treasury?action=add')}>
          Añadir movimiento
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-success-50 dark:bg-success-900/30">
              <TrendingUp className="h-4 w-4 text-success-600 dark:text-success-400" />
            </div>
            <span className="text-sm font-medium text-surface-500">Ingresos</span>
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 tabular-nums font-mono">
            {formatCurrency(s.totalIncome)}
          </p>
          {s.extraIncome > 0 && (
            <p className="text-xs text-surface-400 mt-1">
              Nómina: {formatCurrency(s.salaryIncome)} · Extras: {formatCurrency(s.extraIncome)}
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-danger-50 dark:bg-danger-900/30">
              <TrendingDown className="h-4 w-4 text-danger-600 dark:text-danger-400" />
            </div>
            <span className="text-sm font-medium text-surface-500">Gastos</span>
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-100 tabular-nums font-mono">
            {formatCurrency(s.totalExpenses)}
          </p>
          {s.totalIncome > 0 && (
            <p className="text-xs text-surface-400 mt-1">
              {((s.totalExpenses / s.totalIncome) * 100).toFixed(1)}% de los ingresos
            </p>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30">
              <Wallet className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            </div>
            <span className="text-sm font-medium text-surface-500">Disponible</span>
          </div>
          <p className={`text-2xl font-bold tabular-nums font-mono ${
            s.totalAvailable >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600 dark:text-danger-400'
          }`}>
            {formatCurrency(s.totalAvailable)}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-savings-50 dark:bg-savings-900/30">
              <PiggyBank className="h-4 w-4 text-savings-600 dark:text-savings-400" />
            </div>
            <span className="text-sm font-medium text-surface-500">Ahorro</span>
          </div>
          <p className="text-2xl font-bold text-savings-600 dark:text-savings-400 tabular-nums font-mono">
            {formatCurrency(s.totalSaved > 0 ? s.totalSaved : 0)}
          </p>
        </Card>
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {sectionData.map(({ key, budget, spent }) => {
          const status = calculateBudgetStatus(budget, spent);
          const available = budget - spent;

          return (
            <Card key={key} hover onClick={() => navigate(`/treasury/section/${key}?month=${month}&year=${year}`)}>
              <CardHeader
                title={BUDGET_SECTION_LABELS[key]}
                icon={SECTION_ICONS[key]}
                action={
                  <Badge variant={SECTION_BADGE_VARIANT[key]}>
                    {settings?.[(key + '_percentage') as keyof typeof settings] ?? 0}%
                  </Badge>
                }
              />

              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-surface-500">Presupuesto</span>
                  <span className="text-sm font-mono font-semibold tabular-nums text-surface-900 dark:text-surface-100">
                    {formatCurrency(budget)}
                  </span>
                </div>

                <ProgressBar
                  value={spent}
                  max={budget || 1}
                  size="md"
                  showLabel
                  label={`Gastado: ${formatCurrency(spent)}`}
                />

                <div className="flex justify-between items-baseline pt-1 border-t border-surface-100 dark:border-surface-800">
                  <span className="text-xs text-surface-500">Disponible</span>
                  <span className={`text-sm font-mono font-bold tabular-nums ${
                    available >= 0
                      ? 'text-success-600 dark:text-success-400'
                      : 'text-danger-600 dark:text-danger-400'
                  }`}>
                    {formatCurrency(available)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end mt-3 text-xs text-brand-600 dark:text-brand-400 font-medium">
                Ver detalle <ArrowRight className="h-3 w-3 ml-1" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent transactions */}
      <Card>
        <CardHeader
          title="Últimos movimientos"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          }
        />

        {recentTransactions.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sin movimientos"
            description="Aún no has registrado ningún movimiento este mes."
            action={
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/treasury?action=add')}>
                Añadir primer movimiento
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-surface-100 dark:divide-surface-800">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    t.type === 'expense' ? 'bg-danger-500' : 'bg-success-500'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                      {t.description}
                    </p>
                    <p className="text-xs text-surface-400 truncate">
                      {t.category?.name ?? BUDGET_SECTION_LABELS[t.section as BudgetSection]}
                    </p>
                  </div>
                </div>
                <span className={`text-sm font-mono font-semibold tabular-nums shrink-0 ml-3 ${
                  t.type === 'expense'
                    ? 'text-danger-600 dark:text-danger-400'
                    : 'text-success-600 dark:text-success-400'
                }`}>
                  {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
