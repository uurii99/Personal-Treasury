import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, EmptyState, SkeletonCard } from '@/components/ui';
import { centsToEuros } from '@/lib/money';
import { getMonthNameShort, getCurrentMonthYear } from '@/lib/dates';
import { BarChart3, TrendingUp, PieChart } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPie, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';

const CHART_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

export function StatisticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const currentYear = getCurrentMonthYear().year;

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const loadStats = async () => {
      // Monthly income/expenses for current year
      const monthly: any[] = [];
      for (let m = 1; m <= 12; m++) {
        const [{ data: incomes }, { data: transactions }] = await Promise.all([
          supabase.from('income_entries').select('amount').eq('user_id', user.id).eq('budget_month', m).eq('budget_year', currentYear),
          supabase.from('transactions').select('amount, type').eq('user_id', user.id).eq('budget_month', m).eq('budget_year', currentYear),
        ]);
        const income = (incomes ?? []).reduce((s, i) => s + i.amount, 0);
        const expenses = (transactions ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        monthly.push({ month: getMonthNameShort(m), ingresos: centsToEuros(income), gastos: centsToEuros(expenses) });
      }
      setMonthlyData(monthly);

      // Category breakdown (all time)
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, category:categories(name)')
        .eq('user_id', user.id)
        .eq('type', 'expense')
        .eq('budget_year', currentYear);

      const catMap = new Map<string, number>();
      (transactions ?? []).forEach((t: any) => {
        const name = t.category?.name ?? 'Sin categoría';
        catMap.set(name, (catMap.get(name) ?? 0) + t.amount);
      });

      const catArr = Array.from(catMap.entries())
        .map(([name, amount]) => ({ name, value: centsToEuros(amount) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);
      setCategoryData(catArr);

      setLoading(false);
    };

    loadStats();
  }, [user, currentYear]);

  const hasData = monthlyData.some(m => m.ingresos > 0 || m.gastos > 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Estadísticas</h1>
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Estadísticas</h1>
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Sin datos suficientes"
          description="Registra ingresos y gastos para ver tus estadísticas y gráficos. Los datos se mostrarán automáticamente."
        />
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: 'var(--color-surface-900)',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '12px',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
        Estadísticas — {currentYear}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Monthly Income vs Expenses */}
        <Card>
          <CardHeader title="Ingresos vs Gastos" icon={<BarChart3 className="h-5 w-5" />} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" tickFormatter={(v) => `${v}€`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                <Legend />
                <Bar dataKey="ingresos" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gastos" fill="var(--color-danger-500)" radius={[4, 4, 0, 0]} name="Gastos" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category breakdown */}
        <Card>
          <CardHeader title="Gastos por categoría" icon={<PieChart className="h-5 w-5" />} />
          {categoryData.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-8">Sin datos de categorías.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Monthly evolution */}
        <Card className="lg:col-span-2">
          <CardHeader title="Evolución mensual" icon={<TrendingUp className="h-5 w-5" />} />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" tickFormatter={(v) => `${v}€`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                <Legend />
                <Line type="monotone" dataKey="ingresos" stroke="var(--color-success-500)" strokeWidth={2} dot={{ r: 3 }} name="Ingresos" />
                <Line type="monotone" dataKey="gastos" stroke="var(--color-danger-500)" strokeWidth={2} dot={{ r: 3 }} name="Gastos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top categories table */}
        {categoryData.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader title="Categorías con mayor gasto" />
            <div className="overflow-x-auto">
              <table className="treasury-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Categoría</th>
                    <th className="text-right">Importe</th>
                    <th className="text-right">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryData.map((cat, i) => {
                    const total = categoryData.reduce((s, c) => s + c.value, 0);
                    return (
                      <tr key={cat.name}>
                        <td className="text-surface-400 w-8">{i + 1}</td>
                        <td className="font-medium text-surface-900 dark:text-surface-100">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            {cat.name}
                          </div>
                        </td>
                        <td className="amount-cell font-mono tabular-nums">{cat.value.toFixed(2)} €</td>
                        <td className="amount-cell font-mono tabular-nums text-surface-500">
                          {total > 0 ? ((cat.value / total) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
