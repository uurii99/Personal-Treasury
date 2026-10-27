import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Percent,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
  Receipt,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/money';
import { getCurrentMonthYear } from '@/lib/dates';
import { Button, Modal, Input } from '@/components/ui';
import { PercentageModal } from '@/components/excel/PercentageModal';
import { CellEditModal, type CellEditData } from '@/components/excel/CellEditModal';
import { CellDetailModal, type CellDetailTarget } from '@/components/excel/CellDetailModal';
import { AddRowModal } from '@/components/excel/AddRowModal';
import { AddMovementModal } from '@/components/modals/AddMovementModal';
import { AddIncomeModal } from '@/components/modals/AddIncomeModal';
import { MobileMonthlyView } from '@/components/excel/MobileMonthlyView';
import { isUuriiProfile, syncUuriiExcelData } from '@/lib/syncUuriiExcel';
import { recordMovementInBank } from '@/lib/banks';
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
  { name: 'BENZINA COTXE', section: 'fixed' },
  { name: 'CORTE DE PELO', section: 'fixed' },
  { name: 'GASTOS GENERALES', section: 'fixed' },
  { name: 'OTROS', section: 'fixed' },

  // 2. Gastos Opcionales / Ocio (30%)
  { name: 'COMIDAS', section: 'leisure' },
  { name: 'REGALOS', section: 'leisure' },
  { name: 'PIEZAS MOTO', section: 'leisure' },
  { name: 'HOT WHEELS', section: 'leisure' },
  { name: 'ROPA', section: 'leisure' },
  { name: 'SALIDAS/VIAGES', section: 'leisure' },

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
  const { user, profile, settings, refreshSettings } = useAuth();
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

  // Selected month for mobile view
  const [selectedInspectorMonth, setSelectedInspectorMonth] = useState<number>(currentMY.month);

  // Modals state
  const [showPercentageModal, setShowPercentageModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [addRowDefaultSection, setAddRowDefaultSection] = useState<'income' | BudgetSection>('fixed');
  const [cellEditData, setCellEditData] = useState<CellEditData | null>(null);
  const [cellDetailTarget, setCellDetailTarget] = useState<CellDetailTarget | null>(null);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

  // Rename concept modal state
  const [renameTarget, setRenameTarget] = useState<{
    open: boolean;
    type: 'category' | 'income';
    id?: string;
    oldName: string;
    newName: string;
    section?: BudgetSection;
  }>({
    open: false,
    type: 'category',
    oldName: '',
    newName: '',
  });

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'month' | 'annual'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'month' : 'annual'
  );
  const [excelDensity, setExcelDensity] = useState<'normal' | 'compact' | 'mini'>('compact');

  // 1. Load data
  const loadYearData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Auto-sync for uurii99_ profile from full bank statement GASSTOS.xls
    // Strictly ignores and NEVER modifies any other user's data
    if (isUuriiProfile(user, profile)) {
      const syncKey = `uurii_gasstos_synced_${user.id}_v5`;
      if (localStorage.getItem(syncKey) !== 'true') {
        try {
          await syncUuriiExcelData(user, profile, true);
        } catch (e) {
          console.error('Error auto-syncing uurii excel:', e);
        }
      }
    }

    try {
      // Purge unwanted duplicate categories and mock items
      const unwantedMock = ['Hot Wheels 1', 'Hot Wheels pack', 'Hot Wheels 3', 'Otros fijos', 'Hot Wheels 2', 'Piezas moto 1', 'Piezas moto 2'];
      const unwantedCategoryNames = ['Otros fijos', 'DEPORTES', 'GYM', 'Gimnasio', 'GASOLINA MOTO', 'HOTWHEELS', 'REGALS'];

      for (const u of unwantedCategoryNames) {
        await supabase.from('categories').delete().eq('user_id', user.id).ilike('name', u);
      }
      for (const u of unwantedMock) {
        await supabase.from('transactions').delete().eq('user_id', user.id).ilike('description', u);
      }

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
      setTransactions((transData ?? []).filter((t) => !unwantedMock.some((u) => t.description?.toLowerCase().includes(u.toLowerCase()))));
    } catch (e) {
      console.error('Error loading annual excel data:', e);
      showError('Error al cargar datos del año ' + year);
    } finally {
      setLoading(false);
    }
  }, [user, profile, year, showError]);

  useEffect(() => {
    loadYearData();
  }, [loadYearData]);

  const handleSaveRename = async () => {
    if (!user || !renameTarget.newName.trim()) return;
    const trimmed = renameTarget.newName.trim();
    try {
      if (renameTarget.type === 'category' && renameTarget.id) {
        await supabase
          .from('categories')
          .update({ name: trimmed })
          .eq('id', renameTarget.id);
        await supabase
          .from('transactions')
          .update({ description: trimmed })
          .eq('user_id', user.id)
          .eq('category_id', renameTarget.id);
        success('Categoría renombrada', trimmed);
      } else if (renameTarget.type === 'income') {
        await supabase
          .from('income_entries')
          .update({ description: trimmed })
          .eq('user_id', user.id)
          .eq('description', renameTarget.oldName);
        success('Concepto de ingreso renombrado', trimmed);
      }
      setRenameTarget({ open: false, type: 'category', oldName: '', newName: '' });
      loadYearData();
      window.dispatchEvent(new CustomEvent('excel-data-updated'));
    } catch (err) {
      console.error(err);
      showError('Error al renombrar el concepto');
    }
  };

  const handleDeleteConceptRow = async (
    type: 'category' | 'income',
    name: string,
    catId?: string,
    section?: BudgetSection
  ) => {
    if (!user) return;
    const confirmMsg = language === 'ca'
      ? `Segur que vols eliminar "${name}" i tots els seus moviments associats? S'actualitzaran els saldos bancaris corresponents.`
      : `¿Seguro que deseas eliminar "${name}" y todos sus movimientos asociados? Se actualizarán los saldos bancarios correspondientes.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }
    try {
      if (type === 'income') {
        const { data: incs } = await supabase
          .from('income_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('description', name);
        if (incs && incs.length > 0) {
          for (const inc of incs) {
            recordMovementInBank(user.id, {
              type: 'income',
              amountCents: inc.amount,
              description: inc.description,
              operation: 'remove',
            });
          }
          await supabase
            .from('income_entries')
            .delete()
            .eq('user_id', user.id)
            .eq('description', name);
        }
      } else {
        let query = supabase.from('transactions').select('*').eq('user_id', user.id);
        if (catId) {
          query = query.eq('category_id', catId);
        } else {
          query = query.eq('description', name);
        }
        const { data: txs } = await query;
        if (txs && txs.length > 0) {
          for (const tx of txs) {
            recordMovementInBank(user.id, {
              type: 'expense',
              amountCents: tx.amount,
              section: (tx.section || section) as BudgetSection,
              description: tx.description,
              operation: 'remove',
            });
          }
        }
        if (catId) {
          await supabase.from('transactions').delete().eq('category_id', catId);
          await supabase.from('categories').delete().eq('id', catId);
        } else {
          await supabase.from('transactions').delete().eq('user_id', user.id).eq('description', name);
        }
      }

      success(language === 'ca' ? 'Concepte i moviments eliminats' : 'Concepto y movimientos eliminados', name);
      window.dispatchEvent(new CustomEvent('excel-data-updated'));
      window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
      loadYearData();
    } catch (err) {
      console.error(err);
      showError(language === 'ca' ? 'Error en eliminar el concepte' : 'Error al eliminar el concepto');
    }
  };

  const handleMoveCategory = async (catId: string, direction: 'up' | 'down', section: BudgetSection) => {
    if (!user || !catId) return;
    const sectionCats = categories.filter((c) => c.section === section);
    const idx = sectionCats.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sectionCats.length) return;

    // Build a reordered copy of sectionCats with the swap applied
    const reordered = [...sectionCats];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];

    // Assign new sort_order values based on position (guaranteed distinct)
    const sortOrderMap: Record<string, number> = {};
    reordered.forEach((c, i) => {
      sortOrderMap[c.id] = i * 10; // multiples of 10 to leave room
    });

    const updated = categories.map((c) => {
      if (sortOrderMap[c.id] !== undefined) return { ...c, sort_order: sortOrderMap[c.id] };
      return c;
    }).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    setCategories(updated);

    try {
      await Promise.all(
        Object.entries(sortOrderMap).map(([id, order]) =>
          supabase.from('categories').update({ sort_order: order }).eq('id', id)
        )
      );
    } catch (err) {
      console.error('Error reordering category:', err);
    }
  };

  const [customIncomeOrder, setCustomIncomeOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`custom_income_order_${user?.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const handleMoveIncome = (concept: string, direction: 'up' | 'down') => {
    const list = [...incomeConcepts];
    const idx = list.indexOf(concept);
    if (idx < 0) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    setCustomIncomeOrder(list);
    try {
      if (user?.id) {
        localStorage.setItem(`custom_income_order_${user.id}`, JSON.stringify(list));
      }
    } catch (e) {
      console.error(e);
    }
  };

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
    const all = Array.from(set);
    if (customIncomeOrder && customIncomeOrder.length > 0) {
      all.sort((a, b) => {
        const ia = customIncomeOrder.indexOf(a);
        const ib = customIncomeOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });
    }
    return all;
  }, [incomes, customIncomeOrder]);

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

          {/* View Mode Switcher and Uurii sync */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/25 p-0.5 rounded-xl border border-white/20">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'month'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{language === 'ca' ? 'Vista Mes' : 'Vista Mes'}</span>
              </button>
              <button
                onClick={() => setViewMode('annual')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  viewMode === 'annual'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-white/80 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>{language === 'ca' ? 'Excel Anual' : 'Excel Anual'}</span>
              </button>
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
          {/* Porcentajes selector - high contrast in light & dark */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPercentageModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-900 dark:text-surface-100 transition-all text-xs font-semibold shadow-sm group"
              title={t.common.adjustPercentages}
            >
              <Percent className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="text-surface-600 dark:text-surface-300">
                  {language === 'ca' ? 'Repartiment:' : 'Reparto:'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-bold border border-sky-200 dark:border-sky-800/80">
                  {fp}% {language === 'ca' ? 'Fixes' : 'Fijo'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800/80">
                  {lp}% {language === 'ca' ? 'Opcional' : 'Ocio'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 font-bold border border-purple-200 dark:border-purple-800/80">
                  {sp}% {language === 'ca' ? 'Estalvi' : 'Ahorro'}
                </span>
              </span>
              <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors">
                {language === 'ca' ? 'Canviar %' : 'Cambiar %'}
              </span>
            </button>
          </div>

          {/* Current month indicator (plain text, not a button) */}
          {viewMode === 'annual' && (
            <div className="flex items-center gap-1.5 order-2 sm:order-none text-xs text-surface-600 dark:text-surface-300 font-semibold select-none px-1">
              <span>📍 {t.months[currentMY.month - 1]}</span>
            </div>
          )}

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
                `=${language === 'ca' ? 'RESULTAT_NET' : 'BALANCE_NETO'}(${t.tables.totalEarned} ${formatCurrency(yearTotalIncome)} - ${t.tables.totalSpent} ${formatCurrency(yearTotalExpenses)}) = ${formatCurrency(yearNetBalance)}`}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-surface-200 dark:divide-surface-800 border-b border-surface-200 dark:border-surface-800 text-xs">
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
        </div>

        {viewMode === 'month' ? (
          <div className="p-3 sm:p-4">
            <MobileMonthlyView
              month={selectedInspectorMonth}
              setMonth={setSelectedInspectorMonth}
              year={year}
              incomeConcepts={incomeConcepts}
              incomeMatrix={incomeMatrix}
              fixedMatrix={fixedMatrix}
              leisureMatrix={leisureMatrix}
              savingsMatrix={savingsMatrix}
              monthlyTotalIncome={monthlyTotalIncome}
              monthlyTotalFixed={monthlyTotalFixed}
              monthlyTotalLeisure={monthlyTotalLeisure}
              monthlyTotalSavings={monthlyTotalSavings}
              monthlyAllocatedFixed={monthlyAllocatedFixed}
              monthlyAllocatedLeisure={monthlyAllocatedLeisure}
              monthlyAllocatedSavings={monthlyAllocatedSavings}
              monthlyRemainingFixed={monthlyRemainingFixed}
              monthlyRemainingLeisure={monthlyRemainingLeisure}
              monthlyRemainingSavings={monthlyRemainingSavings}
              monthlyTotalExpenses={monthlyTotalExpenses}
              monthlyNetBalance={monthlyNetBalance}
              fp={fp}
              lp={lp}
              sp={sp}
              onSelectCell={({ type, conceptName, month, amount, section, categoryId }) => {
                setCellEditData({
                  type,
                  conceptName,
                  month,
                  year,
                  currentAmountCents: amount,
                  section,
                  categoryId,
                });
              }}
              onDrilldown={({ type, conceptName, month, section, categoryId }) => {
                setCellDetailTarget({
                  type,
                  conceptName,
                  month,
                  year,
                  section,
                  categoryId,
                });
              }}
              onAddIncome={() => setShowAddIncome(true)}
              onAddMovement={() => setShowAddMovement(true)}
            />
          </div>
        ) : (
          <div className={`excel-density-${excelDensity}`}>
            {/* Main Excel Grid */}
            <div className="overflow-x-auto max-h-[75vh] relative select-text">
            <table className="excel-table">
              {/* COLUMN HEADERS ROW: Letters A, B, C... */}
              <thead>
                <tr className="sticky top-0 z-20">
                  <th className="excel-row-num excel-sticky-col bg-surface-200 dark:bg-surface-800 border-b border-surface-300 dark:border-surface-700">
                    #
                  </th>
                  <th className="excel-col-header excel-sticky-concept min-w-[95px] sm:min-w-[150px] sm:max-w-[170px] text-left px-2 sm:px-2.5 truncate">
                    {language === 'ca' ? 'A · CONCEPTE' : 'A · CONCEPTO'}
                  </th>
                  {MONTHS.map((m, idx) => {
                    const isCurrent = m === currentMY.month && year === currentMY.year;
                    const letter = COL_LETTERS[idx + 1];
                    return (
                      <th
                        key={m}
                        id={`month-col-${m}`}
                        className={`excel-col-header min-w-[52px] sm:min-w-[90px] ${
                          isCurrent
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold'
                            : ''
                        }`}
                      >
                        <div className="text-[10px] text-surface-400">{letter}</div>
                        <div className="flex items-center justify-center gap-1">
                          <span>{t.months[m - 1].toUpperCase()}</span>
                          {isCurrent && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" title={language === 'ca' ? 'Mes actual' : 'Mes actual'} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th className="excel-col-header min-w-[90px] sm:min-w-[130px] bg-surface-200 dark:bg-surface-800/80 font-bold">
                    <div className="text-[10px] text-surface-400">N</div>
                    <span>TOTAL %</span>
                  </th>
                  <th className="excel-col-header min-w-[80px] sm:min-w-[115px] bg-surface-200 dark:bg-surface-800/80 font-bold">
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
                    className="px-2.5 py-1.5 text-emerald-50 bg-[#38761D] dark:bg-emerald-900"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold tracking-normal text-xs">
                        <span className="w-2 h-2 rounded-sm bg-emerald-300 inline-block" />
                        {language === 'ca' ? 'Ingressos 100%' : 'Ingresos 100%'}
                      </span>
                    </div>
                  </td>
                </tr>

                {incomeConcepts
                  .filter((c) => !searchTerm || c.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((concept, idx, arr) => {
                    const row = incomeMatrix[concept] || {};
                    const rowTotal = MONTHS.reduce((s, m) => s + (row[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 4;

                    return (
                      <tr key={concept} className="hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-concept bg-[#E2F0D9] dark:bg-emerald-950/70 font-semibold text-emerald-950 dark:text-emerald-100">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={concept}>{concept}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleMoveIncome(concept, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 rounded text-emerald-700 hover:text-emerald-950 dark:hover:text-emerald-100 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Pujar fila' : 'Subir fila'}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveIncome(concept, 'down')}
                                disabled={idx === arr.length - 1}
                                className="p-0.5 rounded text-emerald-700 hover:text-emerald-950 dark:hover:text-emerald-100 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Baixar fila' : 'Bajar fila'}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameTarget({
                                    open: true,
                                    type: 'income',
                                    oldName: concept,
                                    newName: concept,
                                  });
                                }}
                                className="p-0.5 rounded text-emerald-700 hover:text-emerald-950 dark:hover:text-emerald-100 transition-colors"
                                title={language === 'ca' ? 'Reanomenar concepte' : 'Renombrar concepto'}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteConceptRow('income', concept)}
                                className="p-0.5 rounded text-danger-500 hover:text-danger-700 transition-colors"
                                title={language === 'ca' ? 'Eliminar concepte i ingressos' : 'Eliminar concepto e ingresos'}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
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
                              } ${
                                isCurrent
                                  ? 'bg-[#C6E0B4] dark:bg-emerald-900/60 font-bold'
                                  : 'bg-[#E2F0D9]/80 dark:bg-emerald-950/40'
                              } ${
                                amount > 0
                                  ? 'text-emerald-950 dark:text-emerald-100 font-semibold'
                                  : 'text-emerald-700/60 dark:text-emerald-400/50'
                              }`}
                              title={language === 'ca' ? 'Fes doble clic per editar el valor' : 'Haz doble clic para editar el valor'}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-emerald-950 dark:text-emerald-50 bg-[#A9D18E] dark:bg-emerald-900/80 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-emerald-900 dark:text-emerald-200 bg-[#C6E0B4] dark:bg-emerald-900/50 tabular-nums text-xs">
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
                  <td className="excel-cell excel-sticky-concept bg-[#D9EAD3] dark:bg-emerald-950/80 font-bold text-emerald-950 dark:text-emerald-100 text-right pr-4">
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

                {/* Separador entre Tablas */}
                <tr className="excel-spacer-row">
                  <td colSpan={16} className="excel-spacer-cell" />
                </tr>

                {/* ============================================================== */}
                {/* TABLA 2: PREVISIÓN DE GASTOS FIJOS */}
                {/* ============================================================== */}
                <tr className="bg-[#1C4587] dark:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-slate-300 bg-[#143263] dark:bg-slate-900 border-blue-900">9</td>
                  <td
                    colSpan={15}
                    className="px-2.5 py-1.5 text-blue-50 bg-[#1C4587] dark:bg-slate-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold tracking-normal text-xs">
                        <span className="w-2 h-2 rounded-sm bg-blue-300 inline-block" />
                        {language === 'ca' ? `Fixos ${fp}%` : `Fijos ${fp}%`}
                      </span>
                    </div>
                  </td>
                </tr>

                {Object.values(fixedMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx, arr) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 11;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-blue-100/60 dark:hover:bg-blue-950/40 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-concept bg-[#D9E1F2] dark:bg-blue-950/70 font-semibold text-blue-950 dark:text-blue-100">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={rowItem.name}>{rowItem.name}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'up', 'fixed')}
                                disabled={idx === 0 || !rowItem.catId}
                                className="p-0.5 rounded text-blue-700 hover:text-blue-950 dark:hover:text-blue-100 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Pujar fila' : 'Subir fila'}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'down', 'fixed')}
                                disabled={idx === arr.length - 1 || !rowItem.catId}
                                className="p-0.5 rounded text-blue-700 hover:text-blue-950 dark:hover:text-blue-100 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Baixar fila' : 'Bajar fila'}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameTarget({
                                    open: true,
                                    type: 'category',
                                    id: rowItem.catId,
                                    oldName: rowItem.name,
                                    newName: rowItem.name,
                                    section: 'fixed',
                                  });
                                }}
                                className="p-0.5 rounded text-blue-700 hover:text-blue-950 dark:hover:text-blue-100 transition-colors"
                                title={language === 'ca' ? 'Reanomenar categoria' : 'Renombrar categoría'}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteConceptRow('category', rowItem.name, rowItem.catId, 'fixed')}
                                className="p-0.5 rounded text-danger-500 hover:text-danger-700 transition-colors"
                                title={language === 'ca' ? 'Eliminar categoria i despeses' : 'Eliminar categoría y gastos'}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
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
                              } ${
                                isCurrent
                                  ? 'bg-[#B4C6E7] dark:bg-blue-900/60 font-bold'
                                  : 'bg-[#ECEFF7] dark:bg-blue-950/30'
                              } ${
                                amount > 0
                                  ? 'text-red-700 dark:text-red-300 font-semibold'
                                  : 'text-slate-400/60 dark:text-slate-500/50'
                              }`}
                              title={language === 'ca' ? 'Fes doble clic per editar el valor' : 'Haz doble clic para editar el valor'}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-blue-950 dark:text-blue-50 bg-[#8EA9DB] dark:bg-blue-900/80 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-blue-900 dark:text-blue-200 bg-[#B4C6E7] dark:bg-blue-900/50 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL GASTADO (Tabla 2) */}
                <tr className="bg-[#F4CCCC] dark:bg-red-950/40 font-bold border-t border-b border-red-200 dark:border-red-800">
                  <td className="excel-row-num bg-[#EA9999] dark:bg-red-900 text-red-950 dark:text-red-200">21</td>
                  <td className="excel-cell excel-sticky-concept bg-[#F4CCCC] dark:bg-red-950/60 font-bold text-red-950 dark:text-red-200 text-right pr-4">
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
                  <td className="excel-cell excel-sticky-concept bg-surface-100 dark:bg-surface-800 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.remaining}
                  </td>
                  {MONTHS.map((m) => {
                    const rem = monthlyRemainingFixed[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          rem >= 0
                            ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70'
                            : 'text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/70'
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
                  <td className="excel-cell excel-sticky-concept bg-[#C9DAF8] dark:bg-blue-950/80 font-semibold text-blue-950 dark:text-blue-100 text-right pr-4">
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

                {/* Separador entre Tablas */}
                <tr className="excel-spacer-row">
                  <td colSpan={16} className="excel-spacer-cell" />
                </tr>

                {/* ============================================================== */}
                {/* TABLA 3: PREVISIÓN DE GASTOS OCIO Y VARIABLES */}
                {/* ============================================================== */}
                <tr className="bg-[#BF9000] dark:bg-amber-800 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-amber-200 bg-[#8c6900] dark:bg-amber-950 border-amber-600">26</td>
                  <td
                    colSpan={15}
                    className="px-2.5 py-1.5 text-amber-50 bg-[#BF9000] dark:bg-amber-800"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold tracking-normal text-xs">
                        <span className="w-2 h-2 rounded-sm bg-amber-200 inline-block" />
                        {language === 'ca' ? `Opcional ${lp}%` : `Ocio ${lp}%`}
                      </span>
                    </div>
                  </td>
                </tr>

                {Object.values(leisureMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx, arr) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 28;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-amber-100/60 dark:hover:bg-amber-950/40 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-concept bg-[#FFF2CC] dark:bg-amber-950/70 font-semibold text-amber-950 dark:text-amber-100">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={rowItem.name}>{rowItem.name}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'up', 'leisure')}
                                disabled={idx === 0 || !rowItem.catId}
                                className="p-0.5 rounded text-amber-700 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Pujar fila' : 'Subir fila'}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'down', 'leisure')}
                                disabled={idx === arr.length - 1 || !rowItem.catId}
                                className="p-0.5 rounded text-amber-700 hover:text-amber-950 dark:hover:text-amber-100 hover:bg-amber-200/60 dark:hover:bg-amber-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Baixar fila' : 'Bajar fila'}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameTarget({
                                    open: true,
                                    type: 'category',
                                    id: rowItem.catId,
                                    oldName: rowItem.name,
                                    newName: rowItem.name,
                                    section: 'leisure',
                                  });
                                }}
                                className="p-0.5 rounded text-amber-700 hover:text-amber-950 dark:hover:text-amber-100 transition-colors"
                                title={language === 'ca' ? 'Reanomenar categoria' : 'Renombrar categoría'}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteConceptRow('category', rowItem.name, rowItem.catId, 'leisure')}
                                className="p-0.5 rounded text-danger-500 hover:text-danger-700 transition-colors"
                                title={language === 'ca' ? 'Eliminar categoria i despeses' : 'Eliminar categoría y gastos'}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
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
                              } ${
                                isCurrent
                                  ? 'bg-[#FFE599] dark:bg-amber-900/60 font-bold'
                                  : 'bg-[#FFF8E7] dark:bg-amber-950/30'
                              } ${
                                amount > 0
                                  ? 'text-amber-950 dark:text-amber-100 font-semibold'
                                  : 'text-amber-700/50 dark:text-amber-500/50'
                              }`}
                              title={language === 'ca' ? 'Fes doble clic per editar el valor' : 'Haz doble clic para editar el valor'}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-amber-950 dark:text-amber-50 bg-[#F9CB9C] dark:bg-amber-900/80 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-amber-900 dark:text-amber-200 bg-[#FFE599] dark:bg-amber-900/50 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL GASTADO (Tabla 3) */}
                <tr className="bg-[#F4CCCC] dark:bg-red-950/40 font-bold border-t border-b border-red-200 dark:border-red-800">
                  <td className="excel-row-num bg-[#EA9999] dark:bg-red-900 text-red-950 dark:text-red-200">36</td>
                  <td className="excel-cell excel-sticky-concept bg-[#F4CCCC] dark:bg-red-950/60 font-bold text-red-950 dark:text-red-200 text-right pr-4">
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
                  <td className="excel-cell excel-sticky-concept bg-surface-100 dark:bg-surface-800 font-bold text-surface-900 dark:text-surface-100 text-right pr-4">
                    {t.tables.remaining}
                  </td>
                  {MONTHS.map((m) => {
                    const rem = monthlyRemainingLeisure[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          rem >= 0
                            ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70'
                            : 'text-rose-800 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/70'
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
                  <td className="excel-cell excel-sticky-concept bg-[#FFF2CC] dark:bg-amber-950/80 font-semibold text-amber-950 dark:text-amber-100 text-right pr-4">
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

                {/* Separador entre Tablas */}
                <tr className="excel-spacer-row">
                  <td colSpan={16} className="excel-spacer-cell" />
                </tr>

                {/* ============================================================== */}
                {/* TABLA 4: PREVISIÓN DE INVERSIONES Y AHORRO */}
                {/* ============================================================== */}
                <tr className="bg-[#4A154B] dark:bg-purple-950 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-purple-200 bg-[#350d36] dark:bg-black border-purple-800">41</td>
                  <td
                    colSpan={15}
                    className="px-2.5 py-1.5 text-purple-100 bg-[#4A154B] dark:bg-purple-950"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold tracking-normal text-xs">
                        <span className="w-2 h-2 rounded-sm bg-purple-300 inline-block" />
                        {language === 'ca' ? `Estalvi ${sp}%` : `Ahorro ${sp}%`}
                      </span>
                    </div>
                  </td>
                </tr>

                {Object.values(savingsMatrix)
                  .filter((r) => !searchTerm || r.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((rowItem, idx, arr) => {
                    const rowTotal = MONTHS.reduce((s, m) => s + (rowItem.months[m] || 0), 0);
                    const rowAvg = rowTotal / 12;
                    const rowNum = idx + 43;

                    return (
                      <tr key={rowItem.catId || rowItem.name} className="hover:bg-purple-100/60 dark:hover:bg-purple-950/40 group">
                        <td className="excel-row-num">{rowNum}</td>
                        <td className="excel-cell excel-sticky-concept bg-[#EAD1DC] dark:bg-purple-950/70 font-semibold text-purple-950 dark:text-purple-100">
                          <div className="flex items-center justify-between gap-1">
                            <span className="truncate" title={rowItem.name}>{rowItem.name}</span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'up', 'savings')}
                                disabled={idx === 0 || !rowItem.catId}
                                className="p-0.5 rounded text-purple-700 hover:text-purple-950 dark:hover:text-purple-100 hover:bg-purple-200/60 dark:hover:bg-purple-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Pujar fila' : 'Subir fila'}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleMoveCategory(rowItem.catId, 'down', 'savings')}
                                disabled={idx === arr.length - 1 || !rowItem.catId}
                                className="p-0.5 rounded text-purple-700 hover:text-purple-950 dark:hover:text-purple-100 hover:bg-purple-200/60 dark:hover:bg-purple-900/60 disabled:opacity-20 transition-colors"
                                title={language === 'ca' ? 'Baixar fila' : 'Bajar fila'}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setRenameTarget({
                                    open: true,
                                    type: 'category',
                                    id: rowItem.catId,
                                    oldName: rowItem.name,
                                    newName: rowItem.name,
                                    section: 'savings',
                                  });
                                }}
                                className="p-0.5 rounded text-purple-700 hover:text-purple-950 dark:hover:text-purple-100 transition-colors"
                                title={language === 'ca' ? 'Reanomenar categoria' : 'Renombrar categoría'}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteConceptRow('category', rowItem.name, rowItem.catId, 'savings')}
                                className="p-0.5 rounded text-danger-500 hover:text-danger-700 transition-colors"
                                title={language === 'ca' ? 'Eliminar categoria i estalvis' : 'Eliminar categoría y ahorros'}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
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
                              } ${
                                isCurrent
                                  ? 'bg-[#D5A6BD] dark:bg-purple-900/60 font-bold'
                                  : 'bg-[#F4E8EE] dark:bg-purple-950/30'
                              } ${
                                amount > 0
                                  ? 'text-purple-950 dark:text-purple-100 font-semibold'
                                  : 'text-purple-700/50 dark:text-purple-400/50'
                              }`}
                              title={language === 'ca' ? 'Fes doble clic per editar el valor' : 'Haz doble clic para editar el valor'}
                            >
                              {amount > 0 ? formatCurrency(amount) : '-'}
                            </td>
                          );
                        })}

                        <td className="excel-cell text-right font-mono font-bold text-purple-950 dark:text-purple-50 bg-[#C27BA0] dark:bg-purple-900/80 tabular-nums">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="excel-cell text-right font-mono text-purple-900 dark:text-purple-200 bg-[#D5A6BD] dark:bg-purple-900/50 tabular-nums text-xs">
                          {formatCurrency(rowAvg)}
                        </td>
                      </tr>
                    );
                  })}

                {/* TOTAL INVERTIT/ESTALVIAT (Tabla 4) */}
                <tr className="bg-[#F3E8FF] dark:bg-purple-950/60 font-bold border-t-2 border-b-2 border-purple-300 dark:border-purple-700">
                  <td className="excel-row-num bg-purple-200 dark:bg-purple-900 text-purple-950 dark:text-purple-200">44</td>
                  <td className="excel-cell excel-sticky-concept bg-[#F3E8FF] dark:bg-purple-950/80 font-bold text-purple-950 dark:text-purple-100 text-right pr-4">
                    {t.tables.totalSavings}
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-bold text-purple-900 dark:text-purple-200 tabular-nums"
                    >
                      {formatCurrency(monthlyTotalSavings[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-purple-950 dark:text-purple-100 bg-[#E9D5FF] dark:bg-purple-900 tabular-nums">
                    {formatCurrency(yearTotalSavings)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-purple-900 dark:text-purple-200 bg-[#E9D5FF] dark:bg-purple-900 tabular-nums text-xs">
                    {formatCurrency(yearTotalSavings / 12)}
                  </td>
                </tr>

                {/* RESTANT / SUPERÀVIT APORTAT (Tabla 4) */}
                <tr className="bg-purple-50/60 dark:bg-purple-950/40 font-bold border-b border-purple-200 dark:border-purple-800">
                  <td className="excel-row-num bg-purple-100/70 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200">45</td>
                  <td className="excel-cell excel-sticky-concept bg-purple-50 dark:bg-purple-950/60 font-bold text-purple-950 dark:text-purple-100 text-right pr-4">
                    {language === 'ca' ? 'Superàvit / Restant Aportat:' : 'Superávit / Restante Aportado:'}
                  </td>
                  {MONTHS.map((m) => {
                    const actual = monthlyTotalSavings[m];
                    const budgeted = monthlyAllocatedSavings[m];
                    const diff = actual - budgeted;
                    const hasSurplus = diff > 0;
                    const isExact = diff === 0 && budgeted > 0;

                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          hasSurplus
                            ? 'text-purple-950 dark:text-purple-100 bg-purple-200/90 dark:bg-purple-900/80 shadow-[inset_0_0_0_1px_rgba(147,51,234,0.35)]'
                            : isExact
                            ? 'text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70'
                            : actual > 0
                            ? 'text-amber-800 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/60'
                            : 'text-surface-500 dark:text-surface-400 bg-surface-100/50 dark:bg-surface-800/50'
                        }`}
                        title={
                          hasSurplus
                            ? `¡Superávit! Has aportado ${formatCurrency(diff)} más de lo previsto 🎉`
                            : isExact
                            ? '¡Objetivo de ahorro 100% alcanzado!'
                            : `Faltan ${formatCurrency(Math.abs(diff))} para alcanzar el presupuesto (${formatCurrency(budgeted)}).`
                        }
                      >
                        {hasSurplus ? `+${formatCurrency(diff)}` : isExact ? '✓ 100%' : formatCurrency(diff)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-bold text-purple-950 dark:text-purple-100 bg-purple-200/70 dark:bg-purple-900/70 tabular-nums">
                    {(() => {
                      const totalDiff = yearTotalSavings - Object.values(monthlyAllocatedSavings).reduce((a, b) => a + b, 0);
                      return `${totalDiff > 0 ? '+' : ''}${formatCurrency(totalDiff)}`;
                    })()}
                  </td>
                  <td className="excel-cell text-right font-mono text-surface-500 bg-purple-100/50 dark:bg-purple-900/40 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* MyInvestor / Trade Republic (Tabla 4) - C6 * 30 / 100 */}
                <tr className="bg-[#FAF5FF] dark:bg-purple-950/40 font-semibold text-xs border-b-2 border-purple-200 dark:border-purple-800">
                  <td className="excel-row-num bg-purple-100 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200">46</td>
                  <td className="excel-cell excel-sticky-concept bg-[#FAF5FF] dark:bg-purple-950/60 font-semibold text-purple-950 dark:text-purple-200 text-right pr-4">
                    {t.tables.availableBudget} ({sp}%):
                  </td>
                  {MONTHS.map((m) => (
                    <td
                      key={m}
                      className="excel-cell text-right font-mono font-semibold text-purple-900 dark:text-purple-300 tabular-nums"
                    >
                      {formatCurrency(monthlyAllocatedSavings[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-purple-950 dark:text-purple-100 bg-[#F3E8FF] dark:bg-purple-900 tabular-nums">
                    {formatCurrency(
                      Object.values(monthlyAllocatedSavings).reduce((a, b) => a + b, 0)
                    )}
                  </td>
                  <td className="excel-cell text-right font-mono text-purple-800 dark:text-purple-300 bg-[#F3E8FF] dark:bg-purple-900 tabular-nums text-xs">
                    -
                  </td>
                </tr>

                {/* Separador entre Tablas */}
                <tr className="excel-spacer-row">
                  <td colSpan={16} className="excel-spacer-cell" />
                </tr>

                {/* ============================================================== */}
                {/* RESUMEN GLOBAL: INGRESSOS, DESPESES I RESULTAT NET */}
                {/* ============================================================== */}
                <tr className="bg-surface-900 text-white font-bold text-xs uppercase tracking-wider sticky top-[34px] z-10 shadow-sm">
                  <td className="excel-row-num text-surface-400 bg-black">★</td>
                  <td colSpan={15} className="px-3 py-2 text-surface-100 bg-surface-900 flex items-center justify-between">
                    <span>
                      {language === 'ca'
                        ? 'RESUM GENERAL I RESULTAT NET (INGRESSOS - DESPESES)'
                        : 'RESUMEN GENERAL Y RESULTADO NETO (INGRESOS - GASTOS)'}
                    </span>
                    <span className="text-[10px] text-surface-300 font-normal lowercase tracking-normal">
                      {language === 'ca'
                        ? 'Càlcul pas a pas: Ingressos - (Fixos + Oci + Aportació Estalvi)'
                        : 'Cálculo paso a paso: Ingresos - (Fijos + Ocio + Aportación Ahorro)'}
                    </span>
                  </td>
                </tr>

                {/* 1. (+) Total Ingressos */}
                <tr className="bg-emerald-50/70 dark:bg-emerald-950/40 font-semibold text-xs border-b border-emerald-200 dark:border-emerald-800/60">
                  <td className="excel-row-num bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-900 dark:text-emerald-200">50</td>
                  <td className="excel-cell excel-sticky-concept bg-emerald-50 dark:bg-emerald-950/70 font-semibold text-emerald-950 dark:text-emerald-100 text-right pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">(+)</span>
                      <span>{language === 'ca' ? 'TOTAL INGRESSOS (100%)' : 'TOTAL INGRESOS (100%)'}</span>
                    </span>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono font-semibold text-emerald-800 dark:text-emerald-200 tabular-nums">
                      {formatCurrency(monthlyTotalIncome[m])}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-emerald-900 dark:text-emerald-100 bg-emerald-200/80 dark:bg-emerald-900/80 tabular-nums">
                    {formatCurrency(yearTotalIncome)}
                  </td>
                  <td className="excel-cell text-right font-mono font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 tabular-nums text-xs">
                    {formatCurrency(yearTotalIncome / 12)}
                  </td>
                </tr>

                {/* 2. (-) Total Fixos */}
                <tr className="bg-blue-50/40 dark:bg-blue-950/20 text-xs">
                  <td className="excel-row-num bg-blue-100/50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300">51</td>
                  <td className="excel-cell excel-sticky-concept bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-100 text-right pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-blue-700 dark:text-blue-400 font-bold">(-)</span>
                      <span>{language === 'ca' ? `Gastos Fixos (${fp}%)` : `Gastos Fijos (${fp}%)`}</span>
                    </span>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono text-blue-900 dark:text-blue-200 tabular-nums">
                      {monthlyTotalFixed[m] > 0 ? formatCurrency(monthlyTotalFixed[m]) : '-'}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-semibold text-blue-950 dark:text-blue-100 bg-blue-100/70 dark:bg-blue-900/50 tabular-nums">
                    {formatCurrency(yearTotalFixed)}
                  </td>
                  <td className="excel-cell text-right font-mono text-blue-800 dark:text-blue-300 bg-blue-100/50 dark:bg-blue-900/30 tabular-nums text-xs">
                    {formatCurrency(yearTotalFixed / 12)}
                  </td>
                </tr>

                {/* 3. (-) Total Oci */}
                <tr className="bg-amber-50/40 dark:bg-amber-950/20 text-xs">
                  <td className="excel-row-num bg-amber-100/50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300">52</td>
                  <td className="excel-cell excel-sticky-concept bg-amber-50/70 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 text-right pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-amber-700 dark:text-amber-400 font-bold">(-)</span>
                      <span>{language === 'ca' ? `Gastos Oci (${lp}%)` : `Gastos Ocio (${lp}%)`}</span>
                    </span>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono text-amber-900 dark:text-amber-200 tabular-nums">
                      {monthlyTotalLeisure[m] > 0 ? formatCurrency(monthlyTotalLeisure[m]) : '-'}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-semibold text-amber-950 dark:text-amber-100 bg-amber-100/70 dark:bg-amber-900/50 tabular-nums">
                    {formatCurrency(yearTotalLeisure)}
                  </td>
                  <td className="excel-cell text-right font-mono text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/30 tabular-nums text-xs">
                    {formatCurrency(yearTotalLeisure / 12)}
                  </td>
                </tr>

                {/* 4. (-) Total Estalvi Aportat */}
                <tr className="bg-purple-50/40 dark:bg-purple-950/20 text-xs border-b border-surface-200 dark:border-surface-800">
                  <td className="excel-row-num bg-purple-100/50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300">53</td>
                  <td className="excel-cell excel-sticky-concept bg-purple-50/70 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 text-right pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-purple-700 dark:text-purple-400 font-bold">(-)</span>
                      <span>{language === 'ca' ? `Aportat Estalvi (${sp}%)` : `Aportado Ahorro (${sp}%)`}</span>
                    </span>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono text-purple-900 dark:text-purple-200 tabular-nums">
                      {monthlyTotalSavings[m] > 0 ? formatCurrency(monthlyTotalSavings[m]) : '-'}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-semibold text-purple-950 dark:text-purple-100 bg-purple-100/70 dark:bg-purple-900/50 tabular-nums">
                    {formatCurrency(yearTotalSavings)}
                  </td>
                  <td className="excel-cell text-right font-mono text-purple-800 dark:text-purple-300 bg-purple-100/50 dark:bg-purple-900/30 tabular-nums text-xs">
                    {formatCurrency(yearTotalSavings / 12)}
                  </td>
                </tr>

                {/* 5. (=) TOTAL DESPESES I APORTACIONS */}
                <tr className="bg-rose-50/60 dark:bg-rose-950/30 font-bold text-xs border-b-2 border-rose-200 dark:border-rose-900">
                  <td className="excel-row-num bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200">54</td>
                  <td className="excel-cell excel-sticky-concept bg-rose-50 dark:bg-rose-950/60 font-bold text-rose-950 dark:text-rose-100 text-right pr-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-rose-600 font-bold">(=)</span>
                      <span>{language === 'ca' ? 'TOTAL DESPESES I APORTACIONS' : 'TOTAL GASTOS Y APORTACIONES'}</span>
                    </span>
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m} className="excel-cell text-right font-mono font-bold text-rose-700 dark:text-rose-300 tabular-nums">
                      {monthlyTotalExpenses[m] > 0 ? formatCurrency(monthlyTotalExpenses[m]) : '-'}
                    </td>
                  ))}
                  <td className="excel-cell text-right font-mono font-bold text-rose-900 dark:text-rose-100 tabular-nums bg-rose-100 dark:bg-rose-900/70">
                    {formatCurrency(yearTotalExpenses)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold text-rose-800 dark:text-rose-200 tabular-nums text-xs bg-rose-100 dark:bg-rose-900/70">
                    {formatCurrency(yearTotalExpenses / 12)}
                  </td>
                </tr>

                {/* 6. RESULTAT NET (INGRESSOS - DESPESES) */}
                <tr className="bg-white dark:bg-surface-900 font-extrabold text-sm border-t-2 border-b-2 border-surface-900 dark:border-white shadow-sm">
                  <td className="excel-row-num bg-surface-800 text-white font-black">55</td>
                  <td className="excel-cell excel-sticky-concept bg-surface-100 dark:bg-surface-800 font-black text-surface-900 dark:text-white text-right pr-4">
                    {language === 'ca' ? 'RESULTAT NET (INGRESSOS - DESPESES):' : 'RESULTADO NETO (INGRESOS - GASTOS):'}
                  </td>
                  {MONTHS.map((m) => {
                    const net = monthlyNetBalance[m];
                    const isPositive = net > 0;
                    const isZero = net === 0;
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-extrabold tabular-nums ${
                          isPositive
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80'
                            : isZero
                            ? 'text-surface-500 bg-surface-100/50'
                            : 'text-rose-700 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-950/80'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {formatCurrency(net)}
                      </td>
                    );
                  })}
                  <td
                    className={`excel-cell text-right font-mono font-extrabold tabular-nums ${
                      yearNetBalance >= 0
                        ? 'text-emerald-800 dark:text-emerald-200 bg-emerald-200 dark:bg-emerald-900'
                        : 'text-rose-800 dark:text-rose-200 bg-rose-200 dark:bg-rose-900'
                    }`}
                  >
                    {yearNetBalance > 0 ? '+' : ''}
                    {formatCurrency(yearNetBalance)}
                  </td>
                  <td className="excel-cell text-right font-mono font-bold tabular-nums text-xs bg-surface-200 dark:bg-surface-800">
                    {formatCurrency(yearNetBalance / 12)}
                  </td>
                </tr>

                {/* 7. SALDO TOTAL ACUMULAT (CAIXA / PATRIMONI) */}
                <tr className="bg-emerald-50 dark:bg-emerald-950/40 text-xs font-bold border-b border-emerald-300 dark:border-emerald-700">
                  <td className="excel-row-num bg-emerald-200 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100">56</td>
                  <td className="excel-cell excel-sticky-concept bg-emerald-100/80 dark:bg-emerald-900/80 font-bold text-emerald-950 dark:text-emerald-100 text-right pr-4">
                    {language === 'ca' ? 'SALDO TOTAL ACUMULAT (PATRIMONI/CAIXA):' : 'SALDO TOTAL ACUMULADO (PATRIMONIO/CAJA):'}
                  </td>
                  {MONTHS.map((m) => {
                    const acc = monthlyAccumulatedBalance[m];
                    return (
                      <td
                        key={m}
                        className={`excel-cell text-right font-mono font-bold tabular-nums ${
                          acc >= 0 ? 'text-emerald-950 dark:text-emerald-100' : 'text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {formatCurrency(acc)}
                      </td>
                    );
                  })}
                  <td className="excel-cell text-right font-mono font-black text-emerald-950 dark:text-emerald-100 bg-emerald-300/80 dark:bg-emerald-800 tabular-nums">
                    {formatCurrency(monthlyAccumulatedBalance[12])}
                  </td>
                  <td className="excel-cell text-right font-mono text-emerald-800 dark:text-emerald-200 bg-emerald-200/60 dark:bg-emerald-900/50 text-xs">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

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

      {/* Mobile Quick Cell Action Bar */}
      {viewMode === 'annual' && activeCell?.conceptName && activeCell?.month && (
        <div className="sm:hidden fixed bottom-16 left-3 right-3 z-40 bg-surface-900/95 text-white backdrop-blur-md border border-surface-700 rounded-2xl p-3 shadow-modal flex items-center justify-between gap-3 animate-slideUp">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold truncate text-emerald-300">
              {activeCell.conceptName}
            </p>
            <p className="text-[11px] text-surface-300 font-mono">
              {t.months[activeCell.month - 1]} {year}: <strong className="text-white">{formatCurrency(activeCell.amount || 0)}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                setCellEditData({
                  type: activeCell.type || 'expense',
                  conceptName: activeCell.conceptName || '',
                  month: activeCell.month || currentMY.month,
                  year,
                  currentAmountCents: activeCell.amount || 0,
                  section: activeCell.section,
                  categoryId: activeCell.categoryId,
                });
              }}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-sm active:scale-95"
            >
              <Edit2 className="h-3 w-3" />
              <span>Editar</span>
            </button>
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
              className="px-2.5 py-1.5 bg-surface-800 hover:bg-surface-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 border border-surface-600 shadow-sm active:scale-95"
            >
              <Receipt className="h-3 w-3" />
              <span>Desglose</span>
            </button>
          </div>
        </div>
      )}

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

      <Modal
        open={renameTarget.open}
        onOpenChange={(open) => setRenameTarget((prev) => ({ ...prev, open }))}
        title={
          renameTarget.type === 'income'
            ? (language === 'ca' ? "Reanomenar Concepte d'Ingrés" : 'Renombrar Concepto de Ingreso')
            : (language === 'ca' ? 'Reanomenar Categoria' : 'Renombrar Categoría')
        }
        description={
          language === 'ca'
            ? `Modifica el nom de "${renameTarget.oldName}" a la teva fulla Excel.`
            : `Modifica el nombre de "${renameTarget.oldName}" en tu hoja Excel.`
        }
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSaveRename();
          }}
          className="space-y-4"
        >
          <Input
            label={language === 'ca' ? 'Nou Nom' : 'Nuevo Nombre'}
            value={renameTarget.newName}
            onChange={(e) => setRenameTarget((prev) => ({ ...prev, newName: e.target.value }))}
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-200 dark:border-surface-800">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setRenameTarget((prev) => ({ ...prev, open: false }))}
            >
              {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
            </Button>
            <Button type="submit">{language === 'ca' ? 'Guardar' : 'Guardar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}


