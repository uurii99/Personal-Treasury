import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  Wallet,
  PiggyBank,
  Edit3,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/money';
import { useLanguage } from '@/contexts/LanguageContext';
import type { BudgetSection } from '@/types';

interface MobileMonthlyViewProps {
  month: number;
  setMonth: (m: number) => void;
  year: number;
  incomeConcepts: string[];
  incomeMatrix: Record<string, Record<number, number>>;
  fixedMatrix: Record<string, { catId: string; name: string; months: Record<number, number> }>;
  leisureMatrix: Record<string, { catId: string; name: string; months: Record<number, number> }>;
  savingsMatrix: Record<string, { catId: string; name: string; months: Record<number, number> }>;
  monthlyTotalIncome: Record<number, number>;
  monthlyTotalFixed: Record<number, number>;
  monthlyTotalLeisure: Record<number, number>;
  monthlyTotalSavings: Record<number, number>;
  monthlyAllocatedFixed: Record<number, number>;
  monthlyAllocatedLeisure: Record<number, number>;
  monthlyAllocatedSavings: Record<number, number>;
  monthlyRemainingFixed: Record<number, number>;
  monthlyRemainingLeisure: Record<number, number>;
  monthlyRemainingSavings: Record<number, number>;
  monthlyTotalExpenses: Record<number, number>;
  monthlyNetBalance: Record<number, number>;
  fp: number;
  lp: number;
  sp: number;
  onSelectCell: (data: {
    type: 'income' | 'expense';
    conceptName: string;
    month: number;
    amount: number;
    section?: BudgetSection;
    categoryId?: string;
  }) => void;
  onDrilldown: (data: {
    type: 'income' | 'expense';
    conceptName: string;
    month: number;
    section?: BudgetSection;
    categoryId?: string;
  }) => void;
  onAddIncome: () => void;
  onAddMovement: () => void;
}

export function MobileMonthlyView({
  month,
  setMonth,
  year,
  incomeConcepts,
  incomeMatrix,
  fixedMatrix,
  leisureMatrix,
  savingsMatrix,
  monthlyTotalIncome,
  monthlyTotalFixed,
  monthlyTotalLeisure,
  monthlyTotalSavings,
  monthlyAllocatedFixed,
  monthlyAllocatedLeisure,
  monthlyAllocatedSavings,
  monthlyRemainingFixed,
  monthlyRemainingLeisure,
  monthlyRemainingSavings,
  monthlyTotalExpenses,
  monthlyNetBalance,
  fp,
  lp,
  sp,
  onSelectCell,
  onDrilldown,
  onAddIncome,
  onAddMovement,
}: MobileMonthlyViewProps) {
  const { language, t } = useLanguage();
  const [showMonthDrawer, setShowMonthDrawer] = useState(false);

  const curIncome = monthlyTotalIncome[month] || 0;
  const curExpenses = monthlyTotalExpenses[month] || 0;
  const curNet = monthlyNetBalance[month] || 0;

  const curFixed = monthlyTotalFixed[month] || 0;
  const curAllocFixed = monthlyAllocatedFixed[month] || 0;
  const curRemFixed = monthlyRemainingFixed[month] || 0;

  const curLeisure = monthlyTotalLeisure[month] || 0;
  const curAllocLeisure = monthlyAllocatedLeisure[month] || 0;
  const curRemLeisure = monthlyRemainingLeisure[month] || 0;

  const curSavings = monthlyTotalSavings[month] || 0;
  const curAllocSavings = monthlyAllocatedSavings[month] || 0;
  const curRemSavings = monthlyRemainingSavings[month] || 0;

  const goToPrev = () => {
    if (month > 1) setMonth(month - 1);
    else setMonth(12);
  };

  const goToNext = () => {
    if (month < 12) setMonth(month + 1);
    else setMonth(1);
  };

  const getPercentageBar = (spent: number, allocated: number) => {
    if (allocated <= 0) return 0;
    return Math.min(Math.round((spent / allocated) * 100), 100);
  };

  return (
    <div className="space-y-4 pb-12 select-none">
      {/* ===== MONTH SELECTOR HEADER ===== */}
      <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-2xl p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrev}
            className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 active:scale-95 transition-transform"
            aria-label="Mes anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={() => setShowMonthDrawer(!showMonthDrawer)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-100 dark:bg-surface-800/80 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span className="text-base font-bold text-surface-900 dark:text-surface-100">
              {t.months[month - 1]} {year}
            </span>
            <span className="text-xs text-surface-400">({month}/12)</span>
          </button>

          <button
            onClick={goToNext}
            className="p-2 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-300 active:scale-95 transition-transform"
            aria-label="Mes siguiente"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Month Chips Dropdown / Drawer */}
        {showMonthDrawer && (
          <div className="mt-3 pt-3 border-t border-surface-200 dark:border-surface-800 grid grid-cols-3 gap-1.5 animate-fadeIn">
            {t.months.map((mName, idx) => {
              const mNum = idx + 1;
              const isSelected = mNum === month;
              return (
                <button
                  key={mNum}
                  onClick={() => {
                    setMonth(mNum);
                    setShowMonthDrawer(false);
                  }}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200'
                  }`}
                >
                  {mName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== MONTH SUMMARY KPI CHIPS ===== */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-2.5 text-center">
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
            {language === 'ca' ? 'Ingressos' : 'Ingresos'}
          </span>
          <span className="text-sm font-bold font-mono text-emerald-800 dark:text-emerald-200 tabular-nums">
            {formatCurrency(curIncome)}
          </span>
        </div>

        <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl p-2.5 text-center">
          <span className="text-[10px] font-semibold text-red-700 dark:text-red-300 uppercase tracking-wider block">
            {language === 'ca' ? 'Despeses' : 'Gastos'}
          </span>
          <span className="text-sm font-bold font-mono text-red-800 dark:text-red-200 tabular-nums">
            {formatCurrency(curExpenses)}
          </span>
        </div>

        <div
          className={`border rounded-xl p-2.5 text-center ${
            curNet >= 0
              ? 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700'
              : 'bg-red-100/60 dark:bg-red-900/40 border-red-300 dark:border-red-700'
          }`}
        >
          <span className="text-[10px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider block">
            {language === 'ca' ? 'Disponible' : 'Disponible'}
          </span>
          <span
            className={`text-sm font-bold font-mono tabular-nums ${
              curNet >= 0 ? 'text-surface-900 dark:text-surface-100' : 'text-danger-600'
            }`}
          >
            {curNet > 0 ? '+' : ''}
            {formatCurrency(curNet)}
          </span>
        </div>
      </div>

      {/* ===== SECTION 1: INCOMES (100%) ===== */}
      <div className="bg-white dark:bg-surface-900 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#38761D] dark:bg-emerald-900 text-white px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-200" />
            <h3 className="text-xs font-bold tracking-wide uppercase">
              {t.tables.incomeTitle} (100%)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-100">
              {formatCurrency(curIncome)}
            </span>
            <button
              onClick={onAddIncome}
              className="p-1 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors"
              title="Añadir ingreso"
            >
              <Sparkles className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {incomeConcepts.map((concept) => {
            const amount = incomeMatrix[concept]?.[month] || 0;
            return (
              <div
                key={concept}
                className="px-3.5 py-2.5 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
              >
                <div
                  className="flex-1 min-w-0 pr-3 cursor-pointer"
                  onClick={() =>
                    onDrilldown({
                      type: 'income',
                      conceptName: concept,
                      month,
                    })
                  }
                >
                  <p className="text-xs font-semibold text-surface-900 dark:text-surface-100 truncate">
                    {concept}
                  </p>
                  <p className="text-[10px] text-surface-400 flex items-center gap-1">
                    <Layers className="h-2.5 w-2.5" />
                    <span>{language === 'ca' ? 'Toca per veure desglossament' : 'Toca para ver desglose'}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      onSelectCell({
                        type: 'income',
                        conceptName: concept,
                        month,
                        amount,
                      })
                    }
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-100 dark:bg-surface-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-surface-200 dark:border-surface-700 transition-colors"
                  >
                    <span className="text-xs font-mono font-bold text-surface-900 dark:text-surface-100 tabular-nums">
                      {formatCurrency(amount)}
                    </span>
                    <Edit3 className="h-3 w-3 text-surface-400 hover:text-emerald-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECTION 2: GASTOS FIJOS (40%) ===== */}
      <div className="bg-white dark:bg-surface-900 border border-blue-200 dark:border-blue-900/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#143263] dark:bg-blue-950 text-white px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-blue-300" />
              <h3 className="text-xs font-bold tracking-wide uppercase">
                {t.tables.fixedTitle} ({fp}%)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-blue-200">
              {formatCurrency(curFixed)} / {formatCurrency(curAllocFixed)}
            </span>
          </div>

          {/* Budget progress bar */}
          <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                curRemFixed >= 0 ? 'bg-blue-400' : 'bg-red-400'
              }`}
              style={{ width: `${getPercentageBar(curFixed, curAllocFixed)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-blue-200 mt-1">
            <span>
              {language === 'ca' ? 'Restant:' : 'Restante:'}{' '}
              <strong className={curRemFixed >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {formatCurrency(curRemFixed)}
              </strong>
            </span>
            <span>{curAllocFixed > 0 ? `${((curFixed / curAllocFixed) * 100).toFixed(0)}%` : '0%'}</span>
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {Object.values(fixedMatrix).map((row) => {
            const amount = row.months[month] || 0;
            return (
              <div
                key={row.catId || row.name}
                className="px-3.5 py-2 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
              >
                <div
                  className="flex-1 min-w-0 pr-3 cursor-pointer"
                  onClick={() =>
                    onDrilldown({
                      type: 'expense',
                      section: 'fixed',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                    })
                  }
                >
                  <p className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">
                    {row.name}
                  </p>
                </div>

                <button
                  onClick={() =>
                    onSelectCell({
                      type: 'expense',
                      section: 'fixed',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                      amount,
                    })
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    amount > 0
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-100 font-bold'
                      : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-400 font-normal'
                  }`}
                >
                  <span className="text-xs font-mono tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                  <Edit3 className="h-3 w-3 text-surface-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECTION 3: GASTOS OPCIONALES / OCIO (30%) ===== */}
      <div className="bg-white dark:bg-surface-900 border border-amber-200 dark:border-amber-900/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#B45F06] dark:bg-amber-950 text-white px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-amber-300" />
              <h3 className="text-xs font-bold tracking-wide uppercase">
                {t.tables.leisureTitle} ({lp}%)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-amber-200">
              {formatCurrency(curLeisure)} / {formatCurrency(curAllocLeisure)}
            </span>
          </div>

          {/* Budget progress bar */}
          <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                curRemLeisure >= 0 ? 'bg-amber-300' : 'bg-red-400'
              }`}
              style={{ width: `${getPercentageBar(curLeisure, curAllocLeisure)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-amber-200 mt-1">
            <span>
              {language === 'ca' ? 'Restant:' : 'Restante:'}{' '}
              <strong className={curRemLeisure >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {formatCurrency(curRemLeisure)}
              </strong>
            </span>
            <span>
              {curAllocLeisure > 0 ? `${((curLeisure / curAllocLeisure) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {Object.values(leisureMatrix).map((row) => {
            const amount = row.months[month] || 0;
            return (
              <div
                key={row.catId || row.name}
                className="px-3.5 py-2 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
              >
                <div
                  className="flex-1 min-w-0 pr-3 cursor-pointer"
                  onClick={() =>
                    onDrilldown({
                      type: 'expense',
                      section: 'leisure',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                    })
                  }
                >
                  <p className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">
                    {row.name}
                  </p>
                </div>

                <button
                  onClick={() =>
                    onSelectCell({
                      type: 'expense',
                      section: 'leisure',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                      amount,
                    })
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    amount > 0
                      ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 font-bold'
                      : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-400 font-normal'
                  }`}
                >
                  <span className="text-xs font-mono tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                  <Edit3 className="h-3 w-3 text-surface-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECTION 4: INVERSIONES Y AHORRO (30%) ===== */}
      <div className="bg-white dark:bg-surface-900 border border-purple-200 dark:border-purple-900/60 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-[#4C1D95] dark:bg-purple-950 text-white px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-purple-300" />
              <h3 className="text-xs font-bold tracking-wide uppercase">
                {t.tables.savingsTitle} ({sp}%)
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-purple-200">
              {formatCurrency(curSavings)} / {formatCurrency(curAllocSavings)}
            </span>
          </div>

          {/* Budget progress bar */}
          <div className="w-full bg-black/30 h-1.5 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-300 transition-all duration-300"
              style={{ width: `${getPercentageBar(curSavings, curAllocSavings)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-purple-200 mt-1">
            <span>
              {language === 'ca' ? 'Restant:' : 'Restante:'}{' '}
              <strong className={curRemSavings >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                {formatCurrency(curRemSavings)}
              </strong>
            </span>
            <span>
              {curAllocSavings > 0 ? `${((curSavings / curAllocSavings) * 100).toFixed(0)}%` : '0%'}
            </span>
          </div>
        </div>

        <div className="divide-y divide-surface-100 dark:divide-surface-800">
          {Object.values(savingsMatrix).map((row) => {
            const amount = row.months[month] || 0;
            return (
              <div
                key={row.catId || row.name}
                className="px-3.5 py-2 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors"
              >
                <div
                  className="flex-1 min-w-0 pr-3 cursor-pointer"
                  onClick={() =>
                    onDrilldown({
                      type: 'expense',
                      section: 'savings',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                    })
                  }
                >
                  <p className="text-xs font-medium text-surface-900 dark:text-surface-100 truncate">
                    {row.name}
                  </p>
                </div>

                <button
                  onClick={() =>
                    onSelectCell({
                      type: 'expense',
                      section: 'savings',
                      categoryId: row.catId,
                      conceptName: row.name,
                      month,
                      amount,
                    })
                  }
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors ${
                    amount > 0
                      ? 'bg-purple-50/70 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60 text-purple-900 dark:text-purple-100 font-bold'
                      : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-400 font-normal'
                  }`}
                >
                  <span className="text-xs font-mono tabular-nums">
                    {formatCurrency(amount)}
                  </span>
                  <Edit3 className="h-3 w-3 text-surface-400" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Action Button for quick movement entry on mobile */}
      <div className="fixed bottom-20 right-4 z-30 sm:hidden flex flex-col gap-2">
        <button
          onClick={onAddMovement}
          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-full shadow-lg flex items-center gap-2 text-xs transition-transform"
        >
          <Receipt className="h-4 w-4" />
          <span>+ {language === 'ca' ? 'Despesa' : 'Gasto'}</span>
        </button>
      </div>
    </div>
  );
}
