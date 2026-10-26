import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  Percent,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  Edit2,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency, centsToEuros } from '@/lib/money';
import { getCurrentMonthYear } from '@/lib/dates';
import { Button } from '@/components/ui';
import { PercentageModal } from '@/components/excel/PercentageModal';
import { CellEditModal, type CellEditData } from '@/components/excel/CellEditModal';
import { CellDetailModal, type CellDetailTarget } from '@/components/excel/CellDetailModal';
import { AddRowModal } from '@/components/excel/AddRowModal';
import { AddMovementModal } from '@/components/modals/AddMovementModal';
import { AddIncomeModal } from '@/components/modals/AddIncomeModal';
import type { Category, BudgetSection, IncomeEntry, Transaction } from '@/types';

// Default categories extracted exactly from TRESORERIA URI.xlsx
const INITIAL_CATEGORIES: { name: string; section: BudgetSection }[] = [
  // 1. Gastos Fijos (40%)
  { name: 'GYM - FIJO', section: 'fixed' },
  { name: 'ASSEG. MOTO', section: 'fixed' },
  { name: 'ITV MOTO', section: 'fixed' },
  { name: 'REV./REPARACIONS MOTO', section: 'fixed' },
  { name: 'IMPOST CIRCULACIO MOTO', section: 'fixed' },
  { name: 'TRANSPORT PÚBLIC', section: 'fixed' },
  { name: 'BENZINA MOTO', section: 'fixed' },
  { name: 'CORTE DE PELO', section: 'fixed' },
  { name: 'OTROS', section: 'fixed' },

  // 2. Gastos Opcionales / Ocio (30%)
  { name: 'SALIDAS/VIAGES', section: 'leisure' },
  { name: 'ROPA', section: 'leisure' },
  { name: 'COMIDAS', section: 'leisure' },
  { name: 'DEPORTES', section: 'leisure' },
  { name: 'REGALS', section: 'leisure' },
  { name: 'PIEZAS MOTO', section: 'leisure' },
  { name: 'GASOLINA MOTO', section: 'leisure' },
  { name: 'HOTWHEELS', section: 'leisure' },

  // 3. Inversiones y Ahorro (30%)
  { name: 'INVERSIÓ', section: 'savings' },
  { name: 'FONS EMERGENCIA', section: 'savings' },
];

const DEFAULT_INCOME_CONCEPTS = ['NÒMINA', 'EXTRES'];

// Month names as in TRESORERIA URI.xlsx
const MONTH_NAMES = [
  'GENER',
  'FEBRER',
  'MARÇ',
  'ABRIL',
  'MAIG',
  'JUNY',
  'JULIOL',
  'AGOST',
  'SETEMBRE',
  'OCTUBRE',
  'NOVEMBRE',
  'DESEMBRE',
];

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const COL_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];

export function ExcelAnnualPage() {
  const { user, settings, refreshSettings } = useAuth();
  const { success, error: showError } = useToast();
  const { language, t } = useLanguage();

  const currentMY = getCurrentMonthYear();
  const [year, setYear] = useState(currentMY.year);
  const [loading, setLoading] = useState(true);

  // Raw data from Supabase
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<IncomeEntry[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Active cell selection (Excel feel)
  const [activeCell, setActiveCell] = useState<{
    coord: string;
    concept: string;
    month?: number;
    amount?: number;
    formula?: string;
    type?: 'income' | 'expense';
    section?: BudgetSection;
    categoryId?: string;
    conceptName?: string;
  } | null>(null);

  // Side Inspector (Columns P:R in TRESORERIA URI.xlsx)
  const [selectedInspectorMonth, setSelectedInspectorMonth] = useState<number>(currentMY.month);
  const [showInspector, setShowInspector] = useState<boolean>(true);

  // Modals state
  const [showPercentageModal, setShowPercentageModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [addRowDefaultSection, setAddRowDefaultSection] = useState<'income' | BudgetSection>('fixed');
  const [cellEditData, setCellEditData] = useState<CellEditData | null>(null);
  const [cellDetailTarget, setCellDetailTarget] = useState<CellDetailTarget | null>(null);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Load data
  const loadYearData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Load categories
      let { data: cats } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true });

      // If no categories exist, auto-seed defaults from TRESORERIA URI.xlsx
      if (!cats || cats.length === 0) {
        const seeded = INITIAL_CATEGORIES.map((c, i) => ({
          user_id: user.id,
          name: c.name,
          section: c.section,
          sort_order: i,
        }));
        const { data: insertedCats } = await supabase
          .from('categories')
          .insert(seeded)
          .select('*');
        cats = insertedCats ?? [];
      }
      setCategories(cats ?? []);

      // Load year incomes & transactions in parallel
      const [{ data: incData }, { data: transData }] = await Promise.all([
        supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('budget_year', year),
        supabase
          .from('transactions')
          .select('*, category:categories(id, name, section)')
          .eq('user_id', user.id)
          .eq('budget_year', year)
          .eq('type', 'expense'),
      ]);

      setIncomes(incData ?? []);
      setTransactions(transData ?? []);
    } catch (e) {
      console.error('Error loading annual excel data:', e);
      showError('Error al cargar datos del año ' + year);
    } finally {
      setLoading(false);
    }
  }, [user, year, showError]);

  useEffect(() => {
    loadYearData();
  }, [loadYearData]);

  // Settings percentages (default 40/30/30 matching TRESORERIA URI)
  const fp = settings?.fixed_percentage ?? 40;
  const lp = settings?.leisure_percentage ?? 30;
  const sp = settings?.savings_percentage ?? 30;

  // 2. Compute Table 1: Incomes
  const incomeConcepts = useMemo(() => {
    const set = new Set<string>(DEFAULT_INCOME_CONCEPTS);
    incomes.forEach((i) => {
      if (i.description?.trim()) set.add(i.description.trim());
    });
    return Array.from(set);
  }, [incomes]);

  const incomeMatrix = useMemo(() => {
    const matrix: Record<string, Record<number, number>> = {};
    incomeConcepts.forEach((c) => {
      matrix[c] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    });

    incomes.forEach((i) => {
      const desc = i.description?.trim() || 'EXTRES';
      if (!matrix[desc]) {
        matrix[desc] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
      }
      if (i.budget_month >= 1 && i.budget_month <= 12) {
        matrix[desc][i.budget_month] += i.amount;
      }
    });

    return matrix;
  }, [incomeConcepts, incomes]);

  const monthlyTotalIncome = useMemo(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    Object.values(incomeMatrix).forEach((row) => {
      MONTHS.forEach((m) => {
        totals[m] += row[m] || 0;
      });
    });
    return totals;
  }, [incomeMatrix]);

  const yearTotalIncome = useMemo(
    () => Object.values(monthlyTotalIncome).reduce((a, b) => a + b, 0),
    [monthlyTotalIncome]
  );

  // 3. Compute Section Matrix helper
  const computeSectionMatrix = useCallback(
    (section: BudgetSection) => {
      const sectionCats = categories.filter((c) => c.section === section);
      const matrix: Record<string, { catId: string; name: string; months: Record<number, number> }> = {};

      sectionCats.forEach((c) => {
        matrix[c.id] = {
          catId: c.id,
          name: c.name,
          months: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
        };
      });

      transactions
        .filter((t) => t.section === section)
        .forEach((t) => {
          const catId = t.category_id || 'other';
          if (catId !== 'other' && matrix[catId]) {
            matrix[catId].months[t.budget_month] = (matrix[catId].months[t.budget_month] || 0) + t.amount;
          } else {
            const fallbackKey = 'other_' + section;
            if (!matrix[fallbackKey]) {
              matrix[fallbackKey] = {
                catId: '',
                name: 'OTROS',
                months: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 },
              };
            }
            matrix[fallbackKey].months[t.budget_month] = (matrix[fallbackKey].months[t.budget_month] || 0) + t.amount;
          }
        });

      return matrix;
    },
    [categories, transactions]
  );

  const fixedMatrix = useMemo(() => computeSectionMatrix('fixed'), [computeSectionMatrix]);
  const leisureMatrix = useMemo(() => computeSectionMatrix('leisure'), [computeSectionMatrix]);
  const savingsMatrix = useMemo(() => computeSectionMatrix('savings'), [computeSectionMatrix]);

  // Monthly totals per section
  const computeMonthlyTotals = (matrix: Record<string, { months: Record<number, number> }>) => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    Object.values(matrix).forEach((row) => {
      MONTHS.forEach((m) => {
        totals[m] += row.months[m] || 0;
      });
    });
    return totals;
  };

  const monthlyTotalFixed = useMemo(() => computeMonthlyTotals(fixedMatrix), [fixedMatrix]);
  const monthlyTotalLeisure = useMemo(() => computeMonthlyTotals(leisureMatrix), [leisureMatrix]);
  const monthlyTotalSavings = useMemo(() => computeMonthlyTotals(savingsMatrix), [savingsMatrix]);

  const yearTotalFixed = useMemo(() => Object.values(monthlyTotalFixed).reduce((a, b) => a + b, 0), [monthlyTotalFixed]);
  const yearTotalLeisure = useMemo(() => Object.values(monthlyTotalLeisure).reduce((a, b) => a + b, 0), [monthlyTotalLeisure]);
  const yearTotalSavings = useMemo(() => Object.values(monthlyTotalSavings).reduce((a, b) => a + b, 0), [monthlyTotalSavings]);

  // Allocated budgets per section as in TRESORERIA URI
  const monthlyAllocatedFixed = useMemo(() => {
    const alloc: Record<number, number> = {};
    MONTHS.forEach((m) => {
      alloc[m] = Math.round((monthlyTotalIncome[m] * fp) / 100);
    });
    return alloc;
  }, [monthlyTotalIncome, fp]);

  const monthlyAllocatedLeisure = useMemo(() => {
    const alloc: Record<number, number> = {};
    MONTHS.forEach((m) => {
      alloc[m] = Math.round((monthlyTotalIncome[m] * lp) / 100);
    });
    return alloc;
  }, [monthlyTotalIncome, lp]);

  const monthlyAllocatedSavings = useMemo(() => {
    const alloc: Record<number, number> = {};
    MONTHS.forEach((m) => {
      alloc[m] = Math.round((monthlyTotalIncome[m] * sp) / 100);
    });
    return alloc;
  }, [monthlyTotalIncome, sp]);

  // Remaining per section (Restant = Asignado - Gastado)
  const monthlyRemainingFixed = useMemo(() => {
    const rem: Record<number, number> = {};
    MONTHS.forEach((m) => {
      rem[m] = monthlyAllocatedFixed[m] - monthlyTotalFixed[m];
    });
    return rem;
  }, [monthlyAllocatedFixed, monthlyTotalFixed]);

  const monthlyRemainingLeisure = useMemo(() => {
    const rem: Record<number, number> = {};
    MONTHS.forEach((m) => {
      rem[m] = monthlyAllocatedLeisure[m] - monthlyTotalLeisure[m];
    });
    return rem;
  }, [monthlyAllocatedLeisure, monthlyTotalLeisure]);

  const monthlyRemainingSavings = useMemo(() => {
    const rem: Record<number, number> = {};
    MONTHS.forEach((m) => {
      rem[m] = monthlyAllocatedSavings[m] - monthlyTotalSavings[m];
    });
    return rem;
  }, [monthlyAllocatedSavings, monthlyTotalSavings]);

  // Overall totals
  const monthlyTotalExpenses = useMemo(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    MONTHS.forEach((m) => {
      totals[m] = monthlyTotalFixed[m] + monthlyTotalLeisure[m] + monthlyTotalSavings[m];
    });
    return totals;
  }, [monthlyTotalFixed, monthlyTotalLeisure, monthlyTotalSavings]);

  const yearTotalExpenses = yearTotalFixed + yearTotalLeisure + yearTotalSavings;

  const monthlyNetBalance = useMemo(() => {
    const totals: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    MONTHS.forEach((m) => {
      totals[m] = monthlyTotalIncome[m] - monthlyTotalExpenses[m];
    });
    return totals;
  }, [monthlyTotalIncome, monthlyTotalExpenses]);

  const yearNetBalance = yearTotalIncome - yearTotalExpenses;

  // Running balance
  const monthlyAccumulatedBalance = useMemo(() => {
    const running: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 };
    let acc = settings?.initial_balance ?? 0;
    MONTHS.forEach((m) => {
      acc += monthlyNetBalance[m];
      running[m] = acc;
    });
    return running;
  }, [monthlyNetBalance, settings?.initial_balance]);

  // Actual savings rate achieved
  const yearSavingsRate = yearTotalIncome > 0 ? (yearTotalSavings / yearTotalIncome) * 100 : 0;

  // Quick cell click
  const handleCellClick = (
    _type: 'income' | 'expense',
    conceptName: string,
    month: number,
    amountCents: number,
    colCoord: string,
    rowCoord: number,
    _section?: BudgetSection,
    _categoryId?: string
  ) => {
    const coordStr = `${colCoord}${rowCoord}`;
    const mName = t.months[month - 1];
    setActiveCell({
      coord: coordStr,
      concept: `${conceptName} (${mName})`,
      month,
      amount: amountCents,
      formula: `${conceptName} [${mName} ${year}] = ${formatCurrency(amountCents)}`,
      type: _type,
      section: _section,
      categoryId: _categoryId,
      conceptName,
    });
    setSelectedInspectorMonth(month);
  };

  const handleCellDoubleClick = (
    type: 'income' | 'expense',
    conceptName: string,
    month: number,
    _amountCents: number,
    section?: BudgetSection,
    categoryId?: string
  ) => {
    // Open detailed drilldown modal showing itemized sub-expenses & bank
    setCellDetailTarget({
      type,
      section,
      categoryId,
      conceptName,
      month,
      year,
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [language === 'ca' ? 'Taula' : 'Tabla', t.common.concept, ...t.months, t.tables.totalAnnual, t.tables.monthlyAverage];
    const rows: (string | number)[][] = [headers];

    const addRow = (tabla: string, concepto: string, monthsData: Record<number, number>) => {
      const monthVals = MONTHS.map((m) => centsToEuros(monthsData[m] || 0).toFixed(2));
      const total = centsToEuros(MONTHS.reduce((s, m) => s + (monthsData[m] || 0), 0)).toFixed(2);
      const media = (parseFloat(total) / 12).toFixed(2);
      rows.push([tabla, `"${concepto.replace(/"/g, '""')}"`, ...monthVals, total, media]);
    };

    // 1. Ingresos
    incomeConcepts.forEach((c) => addRow(t.tables.incomeTitle, c, incomeMatrix[c] || {}));
    addRow(t.tables.incomeTitle, t.tables.totalEarned, monthlyTotalIncome);

    // 2. Fijos
    Object.values(fixedMatrix).forEach((r) => addRow(t.tables.fixedTitle, r.name, r.months));
    addRow(t.tables.fixedTitle, t.tables.totalSpent, monthlyTotalFixed);
    addRow(t.tables.fixedTitle, `${t.tables.availableBudget} (${fp}%):`, monthlyAllocatedFixed);
    addRow(t.tables.fixedTitle, t.tables.remaining, monthlyRemainingFixed);

    // 3. Ocio
    Object.values(leisureMatrix).forEach((r) => addRow(t.tables.leisureTitle, r.name, r.months));
    addRow(t.tables.leisureTitle, t.tables.totalSpent, monthlyTotalLeisure);
    addRow(t.tables.leisureTitle, `${t.tables.availableBudget} (${lp}%):`, monthlyAllocatedLeisure);
    addRow(t.tables.leisureTitle, t.tables.remaining, monthlyRemainingLeisure);

    // 4. Ahorro
    Object.values(savingsMatrix).forEach((r) => addRow(t.tables.savingsTitle, r.name, r.months));
    addRow(t.tables.savingsTitle, `${t.tables.availableBudget} (${sp}%):`, monthlyAllocatedSavings);

    // Resumen
    addRow(t.tables.generalSummary, t.tables.totalSpent, monthlyTotalExpenses);
    addRow(t.tables.generalSummary, t.tables.netBalance, monthlyNetBalance);

    const csvContent = '\uFEFF' + rows.map((r) => r.join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PRESSUPOST_ANUAL_TRESORERIA_${year}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Descarga iniciada', `PRESSUPOST_ANUAL_TRESORERIA_${year}.csv generado correctamente.`);
  };

  return (
    <div className="space-y-4">
      {/* ===== EXCEL RIBBON / WORKBOOK HEADER ===== */}
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl shadow-card overflow-hidden">
        {/* Top green Excel header bar (matching PRESSUPOST ANUAL TRESORERIA-2026) */}
        <div className="bg-[#107c41] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-white shadow-inner">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight">
                  {language === 'ca' ? 'PRESSUPOST ANUAL TRESORERIA' : 'PRESUPUESTO ANUAL TESORERÍA'} - {year}.xlsx
                </span>
                <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-medium">
                  {language === 'ca' ? 'Vista Anual' : 'Vista Anual'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 flex items-center gap-1">
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 inline animate-spin text-emerald-200" />{' '}
                    {language === 'ca' ? 'Sincronitzant dades...' : 'Sincronizando datos...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 inline text-emerald-200" />{' '}
                    {language === 'ca' ? 'Sincronitzat en temps real' : 'Sincronizado en tiempo real'}
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Quick year navigation */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/20 rounded-lg p-0.5 border border-white/20">
              <button
                onClick={() => setYear((y) => y - 1)}
                className="p-1.5 rounded hover:bg-white/20 text-white transition-colors"
                title="Año anterior"
                aria-label="Año anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-sm font-bold font-mono min-w-[58px] text-center">{year}</span>
              <button
                onClick={() => setYear((y) => y + 1)}
                className="p-1.5 rounded hover:bg-white/20 text-white transition-colors"
                title="Año siguiente"
                aria-label="Año siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {year !== currentMY.year && (
              <button
                onClick={() => setYear(currentMY.year)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium transition-colors"
              >
                {t.common.currentYear} ({currentMY.year})
              </button>
            )}
          </div>
        </div>

        {/* Excel Action Ribbon */}
        <div className="px-4 py-3 bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex flex-wrap items-center justify-between gap-3">
          {/* Porcentajes selector - allows modifying anytime */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPercentageModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-brand-200 dark:border-brand-800/80 bg-brand-50/70 dark:bg-brand-950/40 hover:bg-brand-100/70 dark:hover:bg-brand-900/40 text-brand-700 dark:text-brand-300 transition-all text-xs font-semibold shadow-sm group"
              title={t.common.adjustPercentages}
            >
              <Percent className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              <span>
                {language === 'ca' ? 'Repartiment:' : 'Reparto:'} <strong className="text-surface-900 dark:text-surface-100">{fp}%</strong> {language === 'ca' ? 'Fixes' : 'Fijo'} ·{' '}
                <strong className="text-surface-900 dark:text-surface-100">{lp}%</strong> {language === 'ca' ? 'Opcional' : 'Ocio'} ·{' '}
                <strong className="text-surface-900 dark:text-surface-100">{sp}%</strong> {language === 'ca' ? 'Estalvi' : 'Ahorro'}
              </span>
              <span className="text-[11px] underline opacity-80 group-hover:opacity-100 ml-1">
                {language === 'ca' ? 'Canviar %' : 'Cambiar %'}
              </span>
            </button>
          </div>

          {/* Quick buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
              onClick={() => setShowAddIncome(true)}
            >
              {language === 'ca' ? 'Ingrés' : 'Ingreso'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Receipt className="h-3.5 w-3.5 text-danger-500" />}
              onClick={() => setShowAddMovement(true)}
            >
              {language === 'ca' ? 'Despesa' : 'Gasto'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={<Plus className="h-3.5 w-3.5 text-brand-600" />}
              onClick={() => {
                setAddRowDefaultSection('fixed');
                setShowAddRowModal(true);
              }}
            >
              {language === 'ca' ? 'Nova fila' : 'Nueva fila'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              icon={showInspector ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              onClick={() => setShowInspector(!showInspector)}
              title={language === 'ca' ? 'Mostrar / ocultar el desglossament mensual' : 'Mostrar / ocultar el desglose mensual'}
            >
              {showInspector ? t.common.hideMonthDetail : t.common.showMonthDetail}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={handleExportCSV}
              title={t.common.exportCSV}
            >
              CSV
            </Button>
          </div>
        </div>

        {/* Excel Formula Bar */}
        <div className="px-4 py-2 bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800 flex items-center gap-3 text-xs">
          <div className="font-mono font-bold text-surface-700 dark:text-surface-300 bg-surface-100 dark:bg-surface-800 px-2.5 py-1 rounded border border-surface-200 dark:border-surface-700 w-16 text-center select-none shrink-0">
            {activeCell?.coord || 'B4'}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-serif italic font-bold text-surface-400 select-none">fx</span>
            <div className="font-mono text-surface-800 dark:text-surface-200 truncate bg-surface-50 dark:bg-surface-800/50 px-2.5 py-1 rounded flex-1 border border-surface-200/50 dark:border-surface-700/50">
              {activeCell?.formula ||
                `=BALANCE_NETO(${t.tables.totalEarned} ${formatCurrency(yearTotalIncome)} - ${t.tables.totalSpent} ${formatCurrency(yearTotalExpenses)}) = ${formatCurrency(yearNetBalance)}`}
            </div>
          </div>

          {/* Quick detail button for selected cell */}
          {activeCell?.conceptName && activeCell?.month && (
            <button
              onClick={() => {
                setCellDetailTarget({
                  type: activeCell.type || 'expense',
                  section: activeCell.section,
                  categoryId: activeCell.categoryId,
                  conceptName: activeCell.conceptName || '',
                  month: activeCell.month || currentMY.month,
                  year,
                });
              }}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded text-xs flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
              title={t.common.seeDetails}
            >
              <Receipt className="h-3 w-3" />
              <span>{t.common.seeDetails}</span>
            </button>
          )}

          {/* Quick search */}
          <div className="relative w-44 hidden md:block shrink-0">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-surface-400" />
            <input
              type="text"
              placeholder={t.common.search}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 border-none text-surface-900 dark:text-surface-100 placeholder-surface-400 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Year KPI Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-surface-200 dark:divide-surface-800 border-b border-surface-200 dark:border-surface-800 text-xs">
          <div className="p-3 flex items-center justify-between">
            <span className="text-surface-500 font-medium">{t.tables.totalEarned}</span>
            <span className="font-mono font-bold text-success-600 dark:text-success-400 tabular-nums">
              {formatCurrency(yearTotalIncome)}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <span className="text-surface-500 font-medium">{t.tables.totalSpent}</span>
            <span className="font-mono font-bold text-danger-600 dark:text-danger-400 tabular-nums">
              {formatCurrency(yearTotalExpenses)}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between">
            <span className="text-surface-500 font-medium">{t.tables.netBalance}</span>
            <span
              className={`font-mono font-bold tabular-nums ${
                yearNetBalance >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600'
              }`}
            >
              {yearNetBalance > 0 ? '+' : ''}
              {formatCurrency(yearNetBalance)}
            </span>
          </div>
          <div className="p-3 flex items-center justify-between bg-brand-50/30 dark:bg-brand-950/20">
            <span className="text-surface-500 font-medium">{t.stats.savingsRate}:</span>
            <span
              className={`font-mono font-bold tabular-nums flex items-center gap-1 ${
                yearSavingsRate >= sp ? 'text-success-600 dark:text-success-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {yearSavingsRate.toFixed(1)}%
              <span className="text-[10px] text-surface-400 font-normal">({language === 'ca' ? 'Obj' : 'Obj'}: {sp}%)</span>
            </span>
          </div>
        </div>

        {/* ===== SPREADSHEET MAIN CONTAINER (Grid + Inspector Widget) ===== */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-surface-200 dark:divide-surface-800">
          {/* Main Excel Grid */}
          <div className="flex-1 overflow-x-auto max-h-[75vh] relative select-text">
            <table className="excel-table">
              {/* COLUMN HEADERS ROW: Letters A, B, C... */}
              <thead>
                <tr className="sticky top-0 z-20">
                  <th className="excel-row-num excel-sticky-col bg-surface-200 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700">
                    #
                  </th>
                  <th className="excel-col-header excel-sticky-col left-[2.25rem] min-w-[210px] text-left px-3">
                    A · CONCEPTE
                  </th>
                  {MONTHS.map((m, idx) => {
                    const isCurrent = m === currentMY.month && year === currentMY.year;
                    const letter = COL_LETTERS[idx + 1];
                    return (
                      <th
                        key={m}
                        className={`excel-col-header min-w-[96px] ${
                          isCurrent
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                            : ''
                        }`}
                      >
                        <div className="text-[10px] text-surface-400">{letter}</div>
                        <div className="flex items-center justify-center gap-1">
                          <span>{MONTH_NAMES[m - 1]}</span>
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title="Mes actual" />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="excel-col-header min-w-[110px] bg-surface-200 dark:bg-surface-800/80 font-bold">
                    <div className="text-[10px] text-surface-400">N</div>
                    <span>TOTAL %</span>
                  </th>
                  <th className="excel-col-header min-w-[95px] bg-surface-200 dark:bg-surface-800/80 font-bold">
                    <div className="text-[10px] text-surface-400">O</div>
                    <span>{t.tables.monthlyAverage}</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {/* ============================================================== */}
                {/* TABLA 1: PREVISIÓN DE INGRESOS */}
                {/* ============================================================== */}
                <tr className="bg-[#38761D] dark:bg-emerald-900 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-emerald-200 bg-[#275314] dark:bg-emerald-950 border-emerald-700">
                    1
                  </td>
                  <td
                    colSpan={15}
                    className="px-3 py-2 flex items-center justify-between text-emerald-50 bg-[#38761D] dark:bg-emerald-900"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-300 inline-block" />
                      {t.tables.incomeTitle}
                    </span>
                    <button
                      onClick={() => {
                        setAddRowDefaultSection('income');
                        setShowAddRowModal(true);
                      }}
                      className="text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors"
                    >
                      {t.tables.incomeAdd}
                    </button>
                  </td>
                </tr>

                {incomeConcepts
                  .filter((c) => !searchTerm || c.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((concept, idx) => {
                    const row = incomeMatrix[concept] || {};
                    const rowTotal = MONTHS.reduce((s, m) => s + (row[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 4;

                    return (
                      <tr key={concept} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-col left-[2.25rem] bg-white dark:bg-surface-900 font-semibold text-surface-800 dark:text-surface-200">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{concept}</span>
                            <button
                              onClick={() => {
                                setCellEditData({
                                  type: 'income',
                                  conceptName: concept,
                                  month: currentMY.month,
                                  year,
                                  currentAmountCents: row[currentMY.month] || 0,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-400 hover:text-emerald-600 transition-opacity"
                              title="Editar en aquest mes"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {MONTHS.map((m, colIdx) => {
                          const amount = row[m] || 0;
                          const colLetter = COL_LETTERS[colIdx + 1];
                          const coord = `${colLetter}${rowNum}`;
                          const isSelected = activeCell?.coord === coord;
                          const isCurrent = m === currentMY.month && year === currentMY.year;

                          return (
                            <td
                              key={m}
                              onClick={() => handleCellClick('income', concept, m, amount, colLetter, rowNum)}
                              onDoubleClick={() => handleCellDoubleClick('income', concept, m, amount)}
                              className={`excel-cell text-right font-mono tabular-nums cursor-pointer transition-colors ${
                                isSelected ? 'excel-cell-active' : ''
                              } ${isCurrent ? 'bg-emerald-50/40 dark:bg-emerald-950/20' : ''} ${
                                amount > 0
                                  ? 'text-surface-900 dark:text-surface-100 font-medium'
                                  : 'text-surface-300 dark:text-surface-600'
                              }`}
                              title="Fes doble clic per editar el valor"
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-success-600 dark:text-success-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* Subtotal Tabla 1 */}
                <tr className="bg-[#D9EAD3] dark:bg-emerald-950/60 font-bold border-t-2 border-b-2 border-emerald-400 dark:border-emerald-700">
                  <td className="excel-row-num bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200">
                    6
                  </td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#D9EAD3] dark:bg-emerald-950/80 font-bold text-emerald-950 dark:text-emerald-100 text-right pr-4">
                    {t.tables.totalEarned}
                  </td>
                  {MONTHS.map((m) => {
                    const mTotal = monthlyTotalIncome[m];
                    return (
                      <td
                        key={m}
                        className="excel-cell text-right font-mono font-bold text-emerald-900 dark:text-emerald-200 tabular-nums"
                      >
                        {formatCurrency(mTotal)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-emerald-950 dark:text-emerald-100 bg-[#C9E0C1] dark:bg-emerald-900 tabular-nums">
                    {formatCurrency(yearTotalIncome)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-emerald-900 dark:text-emerald-200 bg-[#C9E0C1] dark:bg-emerald-900 tabular-nums text-xs">
                    {formatCurrency(yearTotalIncome / 12)}
                  </td>
                </tr>

                {/* ============================================================== */}
                {/* TABLA 2: PREVISIÓN DE GASTOS FIJOS */}
                {/* ============================================================== */}
                <tr className="bg-[#1C4587] dark:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-slate-300 bg-[#143263] dark:bg-slate-900 border-blue-900">9</td>
                  <td
                    colSpan={15}
                    className="px-3 py-2 flex items-center justify-between text-blue-50 bg-[#1C4587] dark:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-blue-300 inline-block" />
                      {t.tables.fixedTitle}
                    </span>
                    <button
                      onClick={() => {
                        setAddRowDefaultSection('fixed');
                        setShowAddRowModal(true);
                      }}
                      className="text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors"
                    >
                      {t.tables.fixedAdd}
                    </button>
                  </td>
                </tr>

                {Object.values(fixedMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 11;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/30 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-col left-[2.25rem] bg-white dark:bg-surface-900 font-semibold text-surface-800 dark:text-surface-200">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{rowItem.name}</span>
                            <button
                              onClick={() => {
                                setCellEditData({
                                  type: 'expense',
                                  section: 'fixed',
                                  categoryId: rowItem.catId,
                                  conceptName: rowItem.name,
                                  month: currentMY.month,
                                  year,
                                  currentAmountCents: rowItem.months[currentMY.month] || 0,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-400 hover:text-blue-600 transition-opacity"
                              title="Editar en aquest mes"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {MONTHS.map((m, colIdx) => {
                          const amount = rowItem.months[m] || 0;
                          const colLetter = COL_LETTERS[colIdx + 1];
                          const coord = `${colLetter}${rowNum}`;
                          const isSelected = activeCell?.coord === coord;
                          const isCurrent = m === currentMY.month && year === currentMY.year;

                          return (
                            <td
                              key={m}
                              onClick={() =>
                                handleCellClick('expense', rowItem.name, m, amount, colLetter, rowNum, 'fixed', rowItem.catId)
                              }
                              onDoubleClick={() =>
                                handleCellDoubleClick('expense', rowItem.name, m, amount, 'fixed', rowItem.catId)
                              }
                              className={`excel-cell text-right font-mono tabular-nums cursor-pointer transition-colors ${
                                isSelected ? 'excel-cell-active' : ''
                              } ${isCurrent ? 'bg-blue-50/40 dark:bg-slate-800/30' : ''} ${
                                amount > 0
                                  ? 'text-surface-900 dark:text-surface-100 font-medium'
                                  : 'text-surface-300 dark:text-surface-600'
                              }`}
                              title="Fes doble clic per editar el valor"
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-surface-900 dark:text-surface-100 bg-surface-50 dark:bg-surface-800/40 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL GASTADO (Tabla 2) */}
                <tr className="bg-[#F4CCCC] dark:bg-red-950/40 font-bold border-t border-b border-red-200 dark:border-red-800">
                  <td className="excel-row-num bg-[#EA9999] dark:bg-red-900 text-red-950 dark:text-red-200">21</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#F4CCCC] dark:bg-red-950/60 font-bold text-red-950 dark:text-red-200 text-right pr-4">
                    {t.tables.totalSpent}
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-bold text-red-700 dark:text-red-300 tabular-nums"
                    >
                      {formatCurrency(monthlyTotalFixed[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-red-800 dark:text-red-200 bg-[#EA9999] dark:bg-red-900 tabular-nums">
                    {formatCurrency(yearTotalFixed)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-red-700 dark:text-red-300 bg-[#EA9999] dark:bg-red-900 tabular-nums text-xs">
                    {formatCurrency(yearTotalFixed / 12)}
                  </td>
                </tr>

                {/* RESTANTE (Tabla 2) */}
                <tr className="bg-surface-100 dark:bg-surface-800 font-bold">
                  <td className="excel-row-num">22</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-surface-100 dark:bg-surface-800 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.remaining}
                  </td>
                  {MONTHS.map((m) => {
                    const rem = monthlyRemainingFixed[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          rem >= 0
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/40'
                            : 'text-red-700 dark:text-red-400 bg-red-50/40'
                        }`}
                      >
                        {formatCurrency(rem)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-surface-900 dark:text-surface-100 bg-surface-200 dark:bg-surface-700 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyRemainingFixed).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-500 bg-surface-200 dark:bg-surface-700 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* PRESUPUESTO ASIGNADO (Tabla 2) - C6 * 40 / 100 */}
                <tr className="bg-[#C9DAF8] dark:bg-blue-950/60 font-semibold text-xs border-b-2 border-blue-300 dark:border-blue-700">
                  <td className="excel-row-num bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200">23</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#C9DAF8] dark:bg-blue-950/80 font-semibold text-blue-950 dark:text-blue-100 text-right pr-4">
                    {t.tables.availableBudget} ({fp}%):
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-semibold text-blue-900 dark:text-blue-200 tabular-nums"
                    >
                      {formatCurrency(monthlyAllocatedFixed[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-blue-950 dark:text-blue-100 bg-blue-200 dark:bg-blue-900 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyAllocatedFixed).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-blue-900 dark:text-blue-200 bg-blue-200 dark:bg-blue-900 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* ============================================================== */}
                {/* TABLA 3: PREVISIÓN DE GASTOS OCIO Y VARIABLES */}
                {/* ============================================================== */}
                <tr className="bg-[#BF9000] dark:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-amber-200 bg-[#8c6900] dark:bg-amber-950 border-amber-600">26</td>
                  <td
                    colSpan={15}
                    className="px-3 py-2 flex items-center justify-between text-amber-50 bg-[#BF9000] dark:bg-amber-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-amber-200 inline-block" />
                      {t.tables.leisureTitle}
                    </span>
                    <button
                      onClick={() => {
                        setAddRowDefaultSection('leisure');
                        setShowAddRowModal(true);
                      }}
                      className="text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors"
                    >
                      {t.tables.leisureAdd}
                    </button>
                  </td>
                </tr>

                {Object.values(leisureMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 28;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-amber-50/50 dark:hover:bg-amber-950/20 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-col left-[2.25rem] bg-white dark:bg-surface-900 font-semibold text-surface-800 dark:text-surface-200">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{rowItem.name}</span>
                            <button
                              onClick={() => {
                                setCellEditData({
                                  type: 'expense',
                                  section: 'leisure',
                                  categoryId: rowItem.catId,
                                  conceptName: rowItem.name,
                                  month: currentMY.month,
                                  year,
                                  currentAmountCents: rowItem.months[currentMY.month] || 0,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-400 hover:text-amber-600 transition-opacity"
                              title="Editar en aquest mes"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {MONTHS.map((m, colIdx) => {
                          const amount = rowItem.months[m] || 0;
                          const colLetter = COL_LETTERS[colIdx + 1];
                          const coord = `${colLetter}${rowNum}`;
                          const isSelected = activeCell?.coord === coord;
                          const isCurrent = m === currentMY.month && year === currentMY.year;

                          return (
                            <td
                              key={m}
                              onClick={() =>
                                handleCellClick('expense', rowItem.name, m, amount, colLetter, rowNum, 'leisure', rowItem.catId)
                              }
                              onDoubleClick={() =>
                                handleCellDoubleClick('expense', rowItem.name, m, amount, 'leisure', rowItem.catId)
                              }
                              className={`excel-cell text-right font-mono tabular-nums cursor-pointer transition-colors ${
                                isSelected ? 'excel-cell-active' : ''
                              } ${isCurrent ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''} ${
                                amount > 0
                                  ? 'text-surface-900 dark:text-surface-100 font-medium'
                                  : 'text-surface-300 dark:text-surface-600'
                              }`}
                              title="Fes doble clic per editar el valor"
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-surface-900 dark:text-surface-100 bg-surface-50 dark:bg-surface-800/40 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL GASTADO (Tabla 3) */}
                <tr className="bg-[#F4CCCC] dark:bg-red-950/40 font-bold border-t border-b border-red-200 dark:border-red-800">
                  <td className="excel-row-num bg-[#EA9999] dark:bg-red-900 text-red-950 dark:text-red-200">36</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#F4CCCC] dark:bg-red-950/60 font-bold text-red-950 dark:text-red-200 text-right pr-4">
                    {t.tables.totalSpent}
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-bold text-red-700 dark:text-red-300 tabular-nums"
                    >
                      {formatCurrency(monthlyTotalLeisure[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-red-800 dark:text-red-200 bg-[#EA9999] dark:bg-red-900 tabular-nums">
                    {formatCurrency(yearTotalLeisure)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-red-700 dark:text-red-300 bg-[#EA9999] dark:bg-red-900 tabular-nums text-xs">
                    {formatCurrency(yearTotalLeisure / 12)}
                  </td>
                </tr>

                {/* RESTANTE (Tabla 3) */}
                <tr className="bg-surface-100 dark:bg-surface-800 font-bold">
                  <td className="excel-row-num">37</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-surface-100 dark:bg-surface-800 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.remaining}
                  </td>
                  {MONTHS.map((m) => {
                    const rem = monthlyRemainingLeisure[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          rem >= 0
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/40'
                            : 'text-red-700 dark:text-red-400 bg-red-50/40'
                        }`}
                      >
                        {formatCurrency(rem)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-surface-900 dark:text-surface-100 bg-surface-200 dark:bg-surface-700 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyRemainingLeisure).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-500 bg-surface-200 dark:bg-surface-700 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* PRESUPUESTO ASIGNADO (Tabla 3) - C6 * 30 / 100 */}
                <tr className="bg-[#FFF2CC] dark:bg-amber-950/60 font-semibold text-xs border-b-2 border-amber-300 dark:border-amber-700">
                  <td className="excel-row-num bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">38</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#FFF2CC] dark:bg-amber-950/80 font-semibold text-amber-950 dark:text-amber-100 text-right pr-4">
                    {t.tables.availableBudget} ({lp}%):
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-semibold text-amber-900 dark:text-amber-200 tabular-nums"
                    >
                      {formatCurrency(monthlyAllocatedLeisure[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-amber-950 dark:text-amber-100 bg-amber-200 dark:bg-amber-900 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyAllocatedLeisure).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-amber-900 dark:text-amber-200 bg-amber-200 dark:bg-amber-900 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* ============================================================== */}
                {/* TABLA 4: PREVISIÓN DE INVERSIONES Y AHORRO */}
                {/* ============================================================== */}
                <tr className="bg-[#434343] dark:bg-surface-800 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-surface-300 bg-[#2b2b2b] dark:bg-surface-950 border-surface-600">41</td>
                  <td
                    colSpan={15}
                    className="px-3 py-2 flex items-center justify-between text-surface-100 bg-[#434343] dark:bg-surface-800"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm bg-purple-400 inline-block" />
                      {t.tables.savingsTitle}
                    </span>
                    <button
                      onClick={() => {
                        setAddRowDefaultSection('savings');
                        setShowAddRowModal(true);
                      }}
                      className="text-[11px] font-medium bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded transition-colors"
                    >
                      {t.tables.savingsAdd}
                    </button>
                  </td>
                </tr>

                {Object.values(savingsMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 43;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-col left-[2.25rem] bg-white dark:bg-surface-900 font-semibold text-surface-800 dark:text-surface-200">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate">{rowItem.name}</span>
                            <button
                              onClick={() => {
                                setCellEditData({
                                  type: 'expense',
                                  section: 'savings',
                                  categoryId: rowItem.catId,
                                  conceptName: rowItem.name,
                                  month: currentMY.month,
                                  year,
                                  currentAmountCents: rowItem.months[currentMY.month] || 0,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-surface-400 hover:text-purple-600 transition-opacity"
                              title="Editar en aquest mes"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>

                        {MONTHS.map((m, colIdx) => {
                          const amount = rowItem.months[m] || 0;
                          const colLetter = COL_LETTERS[colIdx + 1];
                          const coord = `${colLetter}${rowNum}`;
                          const isSelected = activeCell?.coord === coord;
                          const isCurrent = m === currentMY.month && year === currentMY.year;

                          return (
                            <td
                              key={m}
                              onClick={() =>
                                handleCellClick('expense', rowItem.name, m, amount, colLetter, rowNum, 'savings', rowItem.catId)
                              }
                              onDoubleClick={() =>
                                handleCellDoubleClick('expense', rowItem.name, m, amount, 'savings', rowItem.catId)
                              }
                              className={`excel-cell text-right font-mono tabular-nums cursor-pointer transition-colors ${
                                isSelected ? 'excel-cell-active' : ''
                              } ${isCurrent ? 'bg-purple-50/30 dark:bg-purple-950/20' : ''} ${
                                amount > 0
                                  ? 'text-surface-900 dark:text-surface-100 font-medium'
                                  : 'text-surface-300 dark:text-surface-600'
                              }`}
                              title="Fes doble clic per editar el valor"
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-savings-600 dark:text-savings-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-surface-600 dark:text-surface-400 bg-surface-50 dark:bg-surface-800/40 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL INVERTIT/ESTALVIAT (Tabla 4) */}
                <tr className="bg-[#F4CCCC] dark:bg-red-950/40 font-bold border-t border-b border-red-200 dark:border-red-800">
                  <td className="excel-row-num bg-[#EA9999] dark:bg-red-900 text-red-950 dark:text-red-200">44</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-[#F4CCCC] dark:bg-red-950/60 font-bold text-red-950 dark:text-red-200 text-right pr-4">
                    {t.tables.totalSpent}
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-bold text-purple-700 dark:text-purple-300 tabular-nums"
                    >
                      {formatCurrency(monthlyTotalSavings[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-purple-900 dark:text-purple-200 bg-[#EA9999] dark:bg-red-900 tabular-nums">
                    {formatCurrency(yearTotalSavings)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-purple-700 dark:text-purple-300 bg-[#EA9999] dark:bg-red-900 tabular-nums text-xs">
                    {formatCurrency(yearTotalSavings / 12)}
                  </td>
                </tr>

                {/* RESTANT (Tabla 4) - C46 - C44 */}
                <tr className="bg-surface-100 dark:bg-surface-800 font-bold">
                  <td className="excel-row-num">45</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-surface-100 dark:bg-surface-800 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.remaining}
                  </td>
                  {MONTHS.map((m) => {
                    const rem = monthlyRemainingSavings[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          rem >= 0
                            ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/40'
                            : 'text-red-700 dark:text-red-400 bg-red-50/40'
                        }`}
                      >
                        {formatCurrency(rem)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-surface-900 dark:text-surface-100 bg-surface-200 dark:bg-surface-700 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyRemainingSavings).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-500 bg-surface-200 dark:bg-surface-700 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* MY INVERSOR / Trade Republic (Tabla 4) - C6 * 30 / 100 */}
                <tr className="bg-surface-200/80 dark:bg-surface-800 font-semibold text-xs border-b-2 border-surface-400 dark:border-surface-600">
                  <td className="excel-row-num bg-surface-300 dark:bg-surface-700">46</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-surface-200 dark:bg-surface-800 font-semibold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.availableBudget} ({sp}%):
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-semibold text-surface-900 dark:text-surface-100 tabular-nums"
                    >
                      {formatCurrency(monthlyAllocatedSavings[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-surface-950 dark:text-surface-50 bg-surface-300 dark:bg-surface-700 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyAllocatedSavings).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-700 bg-surface-300 dark:bg-surface-700 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* ============================================================== */}
                {/* RESUMEN GLOBAL: RESULTAT NET I CAIXA */}
                {/* ============================================================== */}
                <tr className="bg-surface-900 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-surface-400 bg-black">★</td>
                  <td colSpan={15} className="px-3 py-2 text-surface-100 bg-surface-900">
                    RESUM GENERAL I RESULTAT NET (INGRESSOS - DESPESES)
                  </td>
                </tr>

                {/* Total Despeses */}
                <tr className="bg-surface-100/70 dark:bg-surface-800/60 font-semibold">
                  <td className="excel-row-num">50</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-surface-100 dark:bg-surface-800 font-semibold text-surface-800 dark:text-surface-200 text-right pr-4">
                    TOTAL DESPESES:
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono font-semibold text-danger-600 dark:text-danger-400 tabular-nums">
                      {formatCurrency(monthlyTotalExpenses[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-danger-600 dark:text-danger-400 tabular-nums bg-surface-200 dark:bg-surface-800">
                    {formatCurrency(yearTotalExpenses)}
                  </td>
                  <td className="excel-cell text-right font-mono text-danger-600 dark:text-danger-400 tabular-nums text-xs bg-surface-200 dark:bg-surface-800">
                    {formatCurrency(yearTotalExpenses / 12)}
                  </td>
                </tr>

                {/* Resultat Net */}
                <tr className="bg-white dark:bg-surface-900 font-bold border-t-2 border-b-2 border-surface-300 dark:border-surface-700">
                  <td className="excel-row-num bg-surface-200 dark:bg-surface-800">51</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-white dark:bg-surface-900 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    RESULTAT NET:
                  </td>
                  {MONTHS.map((m) => {
                    const net = monthlyNetBalance[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          net >= 0
                            ? 'text-success-600 dark:text-success-400 bg-success-50/30'
                            : 'text-danger-600 dark:text-danger-400 bg-danger-50/30'
                        }`}
                      >
                        {net > 0 ? '+' : ''}
                        {formatCurrency(net)}
                      </td>
                    );
                  })}
                  <td
                    className={`excel-cell text-right font-mono font-bold tabular-nums bg-surface-100 dark:bg-surface-800 ${
                      yearNetBalance >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600'
                    }`}
                  >
                    {yearNetBalance > 0 ? '+' : ''}
                    {formatCurrency(yearNetBalance)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold tabular-nums text-xs bg-surface-100 dark:bg-surface-800">
                    {formatCurrency(yearNetBalance / 12)}
                  </td>
                </tr>

                {/* Saldo Acumulat */}
                <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 text-xs font-semibold">
                  <td className="excel-row-num bg-emerald-100 dark:bg-emerald-900/40">52</td>
                  <td className="excel-cell excel-sticky-col left-[2.25rem] bg-emerald-50 dark:bg-emerald-950/40 font-semibold text-emerald-950 dark:text-emerald-100 text-right pr-4">
                    SALDO ACUMULAT:
                  </td>
                  {MONTHS.map((m) => {
                    const acc = monthlyAccumulatedBalance[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-semibold tabular-nums ${
                          acc >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600'
                        }`}
                      >
                        {formatCurrency(acc)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 tabular-nums">
                    {formatCurrency(monthlyAccumulatedBalance[12])}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-400 bg-emerald-100 dark:bg-emerald-900/60">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ===== SIDE INSPECTOR WIDGET (COLUMNS P:R FROM TRESORERIA URI.XLSX) ===== */}
          {showInspector && (
            <div className="w-full lg:w-72 bg-surface-50/70 dark:bg-surface-900/80 p-4 shrink-0 flex flex-col justify-between border-t lg:border-t-0 border-surface-200 dark:border-surface-800">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
                      Detall Mes:
                    </span>
                    <select
                      value={selectedInspectorMonth}
                      onChange={(e) => setSelectedInspectorMonth(parseInt(e.target.value, 10))}
                      className="text-xs font-bold font-mono bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg px-2.5 py-1 text-surface-900 dark:text-surface-100"
                    >
                      {MONTHS.map((m) => (
                        <option key={m} value={m}>
                          {MONTH_NAMES[m - 1]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[10px] font-mono text-surface-400">P:R</span>
                </div>

                {/* Mini breakdown table like Uri's Excel */}
                <div className="bg-white dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden shadow-sm">
                  <div className="bg-[#434343] text-white px-3 py-1.5 flex justify-between text-xs font-bold">
                    <span>Concepte</span>
                    <span>Import</span>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto divide-y divide-surface-100 dark:divide-surface-700/60 text-xs">
                    {/* Fixed concepts */}
                    <div className="px-2.5 py-1 bg-blue-50/50 dark:bg-blue-950/30 text-[10px] font-bold text-blue-800 dark:text-blue-300">
                      Fixes
                    </div>
                    {Object.values(fixedMatrix).map((item) => {
                      const amt = item.months[selectedInspectorMonth] || 0;
                      return (
                        <div
                          key={item.catId || item.name}
                          onClick={() =>
                            handleCellDoubleClick('expense', item.name, selectedInspectorMonth, amt, 'fixed', item.catId)
                          }
                          className="px-3 py-1.5 flex justify-between items-center hover:bg-surface-50 dark:hover:bg-surface-700 cursor-pointer transition-colors"
                        >
                          <span className="text-surface-700 dark:text-surface-300 truncate max-w-[140px]">
                            {item.name}
                          </span>
                          <span
                            className={`font-mono tabular-nums ${
                              amt > 0 ? 'font-semibold text-surface-900 dark:text-surface-100' : 'text-surface-400'
                            }`}
                          >
                            {amt > 0 ? formatCurrency(amt) : '-'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Leisure concepts */}
                    <div className="px-2.5 py-1 bg-amber-50/50 dark:bg-amber-950/30 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                      Opcional
                    </div>
                    {Object.values(leisureMatrix).map((item) => {
                      const amt = item.months[selectedInspectorMonth] || 0;
                      return (
                        <div
                          key={item.catId || item.name}
                          onClick={() =>
                            handleCellDoubleClick('expense', item.name, selectedInspectorMonth, amt, 'leisure', item.catId)
                          }
                          className="px-3 py-1.5 flex justify-between items-center hover:bg-surface-50 dark:hover:bg-surface-700 cursor-pointer transition-colors"
                        >
                          <span className="text-surface-700 dark:text-surface-300 truncate max-w-[140px]">
                            {item.name}
                          </span>
                          <span
                            className={`font-mono tabular-nums ${
                              amt > 0 ? 'font-semibold text-surface-900 dark:text-surface-100' : 'text-surface-400'
                            }`}
                          >
                            {amt > 0 ? formatCurrency(amt) : '-'}
                          </span>
                        </div>
                      );
                    })}

                    {/* Savings concepts */}
                    <div className="px-2.5 py-1 bg-purple-50/50 dark:bg-purple-950/30 text-[10px] font-bold text-purple-800 dark:text-purple-300">
                      Estalvi
                    </div>
                    {Object.values(savingsMatrix).map((item) => {
                      const amt = item.months[selectedInspectorMonth] || 0;
                      return (
                        <div
                          key={item.catId || item.name}
                          onClick={() =>
                            handleCellDoubleClick('expense', item.name, selectedInspectorMonth, amt, 'savings', item.catId)
                          }
                          className="px-3 py-1.5 flex justify-between items-center hover:bg-surface-50 dark:hover:bg-surface-700 cursor-pointer transition-colors"
                        >
                          <span className="text-surface-700 dark:text-surface-300 truncate max-w-[140px]">
                            {item.name}
                          </span>
                          <span
                            className={`font-mono tabular-nums ${
                              amt > 0 ? 'font-semibold text-surface-900 dark:text-surface-100' : 'text-surface-400'
                            }`}
                          >
                            {amt > 0 ? formatCurrency(amt) : '-'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Inspector bottom summary */}
              <div className="pt-4 border-t border-surface-200 dark:border-surface-700 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-surface-500">{t.tables.totalEarned}</span>
                  <span className="font-mono font-bold text-success-600 dark:text-success-400">
                    {formatCurrency(monthlyTotalIncome[selectedInspectorMonth])}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-surface-500">{t.tables.totalSpent}</span>
                  <span className="font-mono font-bold text-danger-600 dark:text-danger-400">
                    {formatCurrency(monthlyTotalExpenses[selectedInspectorMonth])}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t border-surface-200 dark:border-surface-700 pt-1">
                  <span>{t.tables.netBalance}</span>
                  <span
                    className={`font-mono ${
                      monthlyNetBalance[selectedInspectorMonth] >= 0
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-danger-600'
                    }`}
                  >
                    {formatCurrency(monthlyNetBalance[selectedInspectorMonth])}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800 flex flex-wrap items-center justify-between gap-3 text-xs text-surface-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#38761D] inline-block" /> 1. {language === 'ca' ? 'Ingressos' : 'Ingresos'}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#1C4587] inline-block" /> 2. {language === 'ca' ? 'Fixes' : 'Fijo'} ({fp}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#BF9000] inline-block" /> 3. {language === 'ca' ? 'Opcional' : 'Ocio'} ({lp}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#434343] inline-block" /> 4. {language === 'ca' ? 'Estalvi' : 'Ahorro'} ({sp}%)
            </span>
          </div>

          <p className="italic text-[11px] text-surface-400">
            💡 {language === 'ca' ? 'Fes doble clic a qualsevol cel·la per veure el desglossament i bancs.' : 'Haz doble clic en cualquier celda para ver el desglose detallado y bancos.'}
          </p>
        </div>
      </div>

      {/* ===== MODALS ===== */}
      <PercentageModal
        open={showPercentageModal}
        onOpenChange={setShowPercentageModal}
        onUpdated={() => {
          refreshSettings();
          loadYearData();
        }}
      />

      <CellDetailModal
        target={cellDetailTarget}
        onClose={() => setCellDetailTarget(null)}
        onUpdated={loadYearData}
      />

      <CellEditModal
        data={cellEditData}
        onClose={() => setCellEditData(null)}
        onSaved={loadYearData}
      />

      <AddRowModal
        open={showAddRowModal}
        onOpenChange={setShowAddRowModal}
        defaultSection={addRowDefaultSection}
        year={year}
        onSaved={loadYearData}
      />

      <AddMovementModal
        open={showAddMovement}
        onOpenChange={setShowAddMovement}
        month={currentMY.month}
        year={year}
        onSaved={loadYearData}
      />

      <AddIncomeModal
        open={showAddIncome}
        onOpenChange={setShowAddIncome}
        month={currentMY.month}
        year={year}
        onSaved={loadYearData}
      />
    </div>
  );
}
