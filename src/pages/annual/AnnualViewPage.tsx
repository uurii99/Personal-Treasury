import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, SkeletonCard } from '@/components/ui';
import { formatCurrency } from '@/lib/money';
import { getMonthNameShort, getCurrentMonthYear } from '@/lib/dates';
import type { AnnualMonthCard } from '@/types';

export function AnnualViewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [year, setYear] = useState(getCurrentMonthYear().year);
  const [months, setMonths] = useState<AnnualMonthCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const loadAnnualData = async () => {
      const result: AnnualMonthCard[] = [];

      for (let m = 1; m <= 12; m++) {
        const [{ data: incomes }, { data: transactions }] = await Promise.all([
          supabase
            .from('income_entries')
            .select('amount')
            .eq('user_id', user.id)
            .eq('budget_month', m)
            .eq('budget_year', year),
          supabase
            .from('transactions')
            .select('amount, type, section')
            .eq('user_id', user.id)
            .eq('budget_month', m)
            .eq('budget_year', year),
        ]);

        const income = (incomes ?? []).reduce((s, i) => s + i.amount, 0);
        const expenses = (transactions ?? [])
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);
        const savings = (transactions ?? [])
          .filter((t) => t.section === 'savings' && t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);

        result.push({
          month: m,
          year,
          income,
          expenses,
          budget: income,
          savings: income > 0 ? Math.max(0, income - expenses) : 0,
          available: income - expenses,
        });
      }

      setMonths(result);
      setLoading(false);
    };

    loadAnnualData();
  }, [user, year]);

  const yearTotals = months.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      savings: acc.savings + m.savings,
    }),
    { income: 0, expenses: 0, savings: 0 }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Vista anual</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setYear((y) => y - 1)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-lg font-bold text-surface-900 dark:text-surface-100 min-w-[60px] text-center">{year}</span>
          <button onClick={() => setYear((y) => y + 1)} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Year summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-success-500" />
            <span className="text-xs text-surface-500">Ingresos anuales</span>
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-success-600 dark:text-success-400">
            {formatCurrency(yearTotals.income)}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-danger-500" />
            <span className="text-xs text-surface-500">Gastos anuales</span>
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-danger-600 dark:text-danger-400">
            {formatCurrency(yearTotals.expenses)}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="h-4 w-4 text-savings-500" />
            <span className="text-xs text-surface-500">Ahorro anual</span>
          </div>
          <p className="text-lg font-bold font-mono tabular-nums text-savings-600 dark:text-savings-400">
            {formatCurrency(yearTotals.savings)}
          </p>
        </Card>
      </div>

      {/* Monthly cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {months.map((m) => {
            const hasData = m.income > 0 || m.expenses > 0;
            const now = getCurrentMonthYear();
            const isCurrent = m.month === now.month && m.year === now.year;

            return (
              <Card
                key={m.month}
                hover
                onClick={() => navigate(`/treasury?month=${m.month}&year=${m.year}`)}
                className={isCurrent ? 'ring-2 ring-brand-500/50' : ''}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                    {getMonthNameShort(m.month)}
                  </h3>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                      Actual
                    </span>
                  )}
                </div>

                {hasData ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-500">Ingresos</span>
                      <span className="font-mono tabular-nums text-success-600 dark:text-success-400 font-medium">
                        {formatCurrency(m.income)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-surface-500">Gastos</span>
                      <span className="font-mono tabular-nums text-danger-600 dark:text-danger-400 font-medium">
                        {formatCurrency(m.expenses)}
                      </span>
                    </div>
                    <div className="border-t border-surface-100 dark:border-surface-800 pt-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-surface-500 font-medium">Disponible</span>
                        <span className={`font-mono tabular-nums font-bold ${m.available >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600'}`}>
                          {formatCurrency(m.available)}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-surface-400 py-2">Sin datos</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
