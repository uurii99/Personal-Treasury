import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, EmptyState, SkeletonCard } from '@/components/ui';
import { centsToEuros, formatCurrency } from '@/lib/money';
import { getCurrentMonthYear } from '@/lib/dates';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  PiggyBank,
  Receipt,
  Droplets,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Line,
  Legend,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import { getBankAccounts, calculateBankLiquidity } from '@/lib/banks';

const PALETTE = ['#0284c7', '#f59e0b', '#8b5cf6', '#10b981', '#ec4899', '#06b6d4', '#ef4444', '#84cc16'];

export function StatisticsPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [loading, setLoading] = useState(true);

  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [sectionDistribution, setSectionDistribution] = useState<{ name: string; value: number; color: string; target: number }[]>([]);
  const [bankDistribution, setBankDistribution] = useState<any[]>([]);
  const [bankLiquidityData, setBankLiquidityData] = useState<any>(null);

  const currentYear = getCurrentMonthYear().year;
  const cacheKey = user ? `pt_stats_cache_${user.id}_${currentYear}` : null;

  // Instant cache preload: loads immediately with 0 delay upon entering the page
  useEffect(() => {
    if (!cacheKey) return;
    try {
      const saved = localStorage.getItem(cacheKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.monthlyData) setMonthlyData(parsed.monthlyData);
        if (parsed.categoryData) setCategoryData(parsed.categoryData);
        if (parsed.sectionDistribution) setSectionDistribution(parsed.sectionDistribution);
        if (parsed.bankDistribution) setBankDistribution(parsed.bankDistribution);
        if (parsed.bankLiquidityData) setBankLiquidityData(parsed.bankLiquidityData);
        setLoading(false);
      }
    } catch (e) {
      console.warn('Could not read stats cache:', e);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (!user) return;

    const loadStats = async () => {
      try {
        // Fast single parallel query for the entire year (1 network roundtrip instead of 12 sequential requests)
        const [{ data: allIncomes }, { data: allTransactions }] = await Promise.all([
          supabase
            .from('income_entries')
            .select('amount, budget_month')
            .eq('user_id', user.id)
            .eq('budget_year', currentYear),
          supabase
            .from('transactions')
            .select('amount, type, section, budget_month, category:categories(name), description')
            .eq('user_id', user.id)
            .eq('budget_year', currentYear),
        ]);

        // Aggregate by month in memory instantaneously (< 1ms)
        const incomeByMonth = new Array(13).fill(0);
        (allIncomes ?? []).forEach((inc) => {
          if (inc.budget_month >= 1 && inc.budget_month <= 12) {
            incomeByMonth[inc.budget_month] += inc.amount || 0;
          }
        });

        const expenseByMonth = new Array(13).fill(0);
        (allTransactions ?? [])
          .filter((t) => t.type === 'expense')
          .forEach((tr) => {
            if (tr.budget_month >= 1 && tr.budget_month <= 12) {
              expenseByMonth[tr.budget_month] += tr.amount || 0;
            }
          });

        const monthly: any[] = [];
        let runningCumulative = 0;
        for (let m = 1; m <= 12; m++) {
          const income = incomeByMonth[m];
          const expenses = expenseByMonth[m];
          const net = income - expenses;
          runningCumulative += net;

          monthly.push({
            month: t.monthsShort[m - 1],
            ingresos: centsToEuros(income),
            gastos: centsToEuros(expenses),
            superavit: centsToEuros(net),
            ahorroAcumulado: centsToEuros(runningCumulative),
          });
        }
        setMonthlyData(monthly);

        // Category breakdown & section distribution
        const catMap = new Map<string, number>();
        let fixedTotal = 0;
        let leisureTotal = 0;
        let savingsTotal = 0;

        (allTransactions ?? [])
          .filter((t) => t.type === 'expense')
          .forEach((tItem: any) => {
            const name = tItem.category?.name || tItem.description || (language === 'ca' ? 'Sense categoria' : 'Sin categoría');
            catMap.set(name, (catMap.get(name) ?? 0) + tItem.amount);

            if (tItem.section === 'fixed') fixedTotal += tItem.amount;
            else if (tItem.section === 'leisure') leisureTotal += tItem.amount;
            else if (tItem.section === 'savings') savingsTotal += tItem.amount;
          });

        const catArr = Array.from(catMap.entries())
          .map(([name, amount]) => ({ name, value: centsToEuros(amount) }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 7);
        setCategoryData(catArr);

        // Rule 40 / 30 / 30 Section Distribution
        const totalExpenseAll = fixedTotal + leisureTotal + savingsTotal;
        let secDist: any[] = [];
        if (totalExpenseAll > 0) {
          secDist = [
            {
              name: language === 'ca' ? 'Fixos (Objectiu 40%)' : 'Fijos (Objetivo 40%)',
              value: centsToEuros(fixedTotal),
              color: '#0284c7', // Sky Blue
              target: 40,
            },
            {
              name: language === 'ca' ? 'Oci / Variable (Objectiu 30%)' : 'Ocio / Variable (Objetivo 30%)',
              value: centsToEuros(leisureTotal),
              color: '#f59e0b', // Amber
              target: 30,
            },
            {
              name: language === 'ca' ? 'Estalvi / Inversió (Objectiu 30%)' : 'Ahorro / Inversión (Objetivo 30%)',
              value: centsToEuros(savingsTotal),
              color: '#8b5cf6', // Purple
              target: 30,
            },
          ];
          setSectionDistribution(secDist);
        } else {
          setSectionDistribution([]);
        }

        // Bank Accounts & Liquidity Distribution
        const accounts = getBankAccounts(user.id);
        const liq = calculateBankLiquidity(accounts);
        setBankLiquidityData(liq);

        const bankArr = accounts
          .filter((a) => !a.is_cash && !a.exclude_from_calculations && a.purpose !== 'cash')
          .map((a) => {
            let bColor = '#0284c7';
            if (a.id.includes('revolut')) bColor = '#06b6d4';
            else if (a.id.includes('trade')) bColor = '#f59e0b';
            else if (a.id.includes('myinvestor') || a.id.includes('myinversor')) bColor = '#8b5cf6';
            return {
              name: a.name,
              value: centsToEuros(a.balance),
              color: bColor,
              isLiquidity: a.id.includes('sabadell') || a.id.includes('revolut'),
            };
          })
          .filter((b) => b.value > 0);

        setBankDistribution(bankArr);

        // Persist to local cache for instantaneous future loads
        if (cacheKey) {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              monthlyData: monthly,
              categoryData: catArr,
              sectionDistribution: secDist,
              bankDistribution: bankArr,
              bankLiquidityData: liq,
            })
          );
        }
      } catch (err) {
        console.error('Error loading stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, [user, currentYear, language, t.monthsShort, cacheKey]);

  const hasData = monthlyData.some((m) => m.ingresos > 0 || m.gastos > 0) || bankDistribution.length > 0;

  // Annual Totals
  const totalAnnualIncome = useMemo(() => monthlyData.reduce((s, m) => s + m.ingresos, 0), [monthlyData]);
  const totalAnnualExpenses = useMemo(() => monthlyData.reduce((s, m) => s + m.gastos, 0), [monthlyData]);
  const totalAnnualSavings = totalAnnualIncome - totalAnnualExpenses;
  const annualSavingsRate = totalAnnualIncome > 0 ? (totalAnnualSavings / totalAnnualIncome) * 100 : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{t.stats.title}</h1>
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{t.stats.title}</h1>
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title={language === 'ca' ? 'Sense dades suficients' : 'Sin datos suficientes'}
          description={
            language === 'ca'
              ? 'Registra ingressos i despeses a la teva fulla anual per veure les estadístiques completes.'
              : 'Registra ingresos y gastos en tu hoja anual para ver las estadísticas completas.'
          }
        />
      </div>
    );
  }

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    color: '#f8fafc',
    fontSize: '12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
  };

  const incomeLabel = language === 'ca' ? 'Ingressos' : 'Ingresos';
  const expenseLabel = language === 'ca' ? 'Despeses' : 'Gastos';
  const netLabel = language === 'ca' ? 'Superàvit / Estalvi Net' : 'Superávit / Ahorro Neto';

  return (
    <div className="space-y-6">
      {/* Top Header & Year Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">
            {t.stats.title} — {currentYear}
          </h1>
          <p className="text-xs text-surface-500 mt-1">
            Gráficos analíticos variados: balance mensual, regla 40/30/30, ahorro acumulado, y distribución de liquidez.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
            Año Fiscal {currentYear}
          </span>
        </div>
      </div>

      {/* 4 Summary Highlight Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-surface-900 p-4 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500 font-medium">Ingresos Anuales</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {totalAnnualIncome.toFixed(2)} €
          </p>
          <span className="text-[11px] text-surface-400">Total percibido en el año</span>
        </div>

        <div className="bg-white dark:bg-surface-900 p-4 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500 font-medium">Gastos Anuales</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {totalAnnualExpenses.toFixed(2)} €
          </p>
          <span className="text-[11px] text-surface-400">Total devengado en el año</span>
        </div>

        <div className="bg-white dark:bg-surface-900 p-4 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500 font-medium">Superávit Neto Generado</span>
            <Award className="h-4 w-4 text-blue-500" />
          </div>
          <p className={`text-2xl font-extrabold font-mono mt-1 tabular-nums ${totalAnnualSavings >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-danger-600'}`}>
            {totalAnnualSavings >= 0 ? '+' : ''}{totalAnnualSavings.toFixed(2)} €
          </p>
          <span className="text-[11px] text-surface-400">Ingresos menos gastos</span>
        </div>

        <div className="bg-white dark:bg-surface-900 p-4 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-surface-500 font-medium">Tasa de Ahorro Real</span>
            <PiggyBank className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
            {annualSavingsRate.toFixed(1)}%
          </p>
          <span className="text-[11px] text-surface-400">Capacidad neta de ahorro</span>
        </div>
      </div>

      {/* Grid of 4 Varied and Distinct Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* GRÁFICO 1: Balance Mensual & Capacidad de Ahorro (Composed Chart) */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="1. Balance Mensual y Capacidad de Ahorro"
            description="Compara mes a mes tus ingresos, gastos totales y el superávit neto resultante generado."
            icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
          />
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" tickFormatter={(v) => `${v}€`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                <Legend />
                <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} name={incomeLabel} />
                <Bar dataKey="gastos" fill="#f43f5e" radius={[4, 4, 0, 0]} name={expenseLabel} />
                <Line
                  type="monotone"
                  dataKey="superavit"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#0284c7' }}
                  name={netLabel}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* GRÁFICO 2: Cumplimiento Regla 40/30/30 (Donut Chart) */}
        <Card>
          <CardHeader
            title="2. Cumplimiento Regla 40 / 30 / 30"
            description="Distribución real de tus gastos según los tres pilares de tu tesorería."
            icon={<PieChart className="h-5 w-5 text-sky-600" />}
          />
          {sectionDistribution.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-12">
              Sin datos de secciones de gasto todavía.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={sectionDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ percent }: any) => `${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {sectionDistribution.map((entry, index) => (
                        <Cell key={`sec-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>

              {/* Target vs Real Breakdown */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-100 dark:border-surface-800 text-center">
                {sectionDistribution.map((sec) => {
                  const total = sectionDistribution.reduce((s, i) => s + i.value, 0);
                  const realPct = total > 0 ? (sec.value / total) * 100 : 0;
                  const diff = realPct - sec.target;
                  return (
                    <div key={sec.name} className="p-2 rounded-xl bg-surface-50 dark:bg-surface-800/60">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
                        <span className="text-[11px] font-bold text-surface-800 dark:text-surface-200 truncate">
                          {sec.target}% Objetivo
                        </span>
                      </div>
                      <p className="text-sm font-bold font-mono text-surface-900 dark:text-surface-100">
                        {realPct.toFixed(1)}% Real
                      </p>
                      <span className={`text-[10px] font-medium ${diff > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        {/* GRÁFICO 3: Evolución del Ahorro Acumulado (AreaChart con degradado suave) */}
        <Card>
          <CardHeader
            title="3. Crecimiento del Ahorro Acumulado"
            description="Evolución temporal del colchón financiero y ahorro generado a lo largo del año."
            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
          />
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorAhorro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" tickFormatter={(v) => `${v}€`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`, 'Ahorro Acumulado']} />
                <Area
                  type="monotone"
                  dataKey="ahorroAcumulado"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorAhorro)"
                  name="Ahorro Acumulado"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-surface-500 text-center">
            💡 Muestra la suma progresiva de los remanentes mensuales de tesorería.
          </div>
        </Card>

        {/* GRÁFICO 4: Distribución de Bancos y Liquidez (Pie / Donut) */}
        <Card>
          <CardHeader
            title="4. Distribución en Cuentas y Liquidez"
            description="Reparto del dinero entre cuentas operativas de liquidez y cuentas de ahorro/inversión."
            icon={<Droplets className="h-5 w-5 text-cyan-600" />}
          />
          {bankDistribution.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-12">
              Sin saldo en cuentas bancarias.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={bankDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                    >
                      {bankDistribution.map((entry, index) => (
                        <Cell key={`bank-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>

              {bankLiquidityData && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-surface-100 dark:border-surface-800 text-xs">
                  <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/50 dark:border-sky-800/50">
                    <span className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1">
                      <Droplets className="w-3.5 h-3.5" /> Liquidez Operativa
                    </span>
                    <p className="text-base font-extrabold font-mono text-sky-900 dark:text-sky-100 mt-1">
                      {formatCurrency(bankLiquidityData.liquidityCents)}
                    </p>
                    <span className="text-[10px] text-sky-700 dark:text-sky-400">Sabadell + Revolut</span>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-800/50">
                    <span className="font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Emergencia & Inversión
                    </span>
                    <p className="text-base font-extrabold font-mono text-purple-900 dark:text-purple-100 mt-1">
                      {formatCurrency(bankLiquidityData.emergencyFundCents + bankLiquidityData.investmentsCents)}
                    </p>
                    <span className="text-[10px] text-purple-700 dark:text-purple-400">Trade Rep. + MyInversor</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* GRÁFICO 5 / TABLA: Top Categorías con Mayor Gasto */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="5. Top Categorías y Conceptos de Gasto"
            description="Los 7 conceptos donde se concentra el mayor volumen de gasto durante el año."
            icon={<Receipt className="h-5 w-5 text-amber-600" />}
          />
          {categoryData.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-8">
              Sin movimientos registrados en este año.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Horizontal Bar visualization */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 60, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} stroke="var(--color-surface-400)" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-surface-400)" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)} €`]} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Gasto Total" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table breakdown */}
              <div className="overflow-x-auto">
                <table className="treasury-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Concepto / Categoría</th>
                      <th className="text-right">Importe Total</th>
                      <th className="text-right">% Sobre Total Gastos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryData.map((cat, i) => {
                      const total = categoryData.reduce((s, c) => s + c.value, 0);
                      const pct = total > 0 ? (cat.value / total) * 100 : 0;
                      return (
                        <tr key={cat.name}>
                          <td className="text-surface-400 w-8">{i + 1}</td>
                          <td className="font-medium text-surface-900 dark:text-surface-100">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                              {cat.name}
                            </div>
                          </td>
                          <td className="amount-cell font-mono tabular-nums">{cat.value.toFixed(2)} €</td>
                          <td className="amount-cell font-mono tabular-nums text-surface-500">
                            {pct.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
