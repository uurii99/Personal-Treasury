import { supabase } from '@/lib/supabase';
import { eurosToCents } from '@/lib/money';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, BudgetSection } from '@/types';

/**
 * Checks if the user/profile corresponds to uurii99_
 */
export function isUuriiProfile(
  user: User | { id?: string; email?: string | null; user_metadata?: Record<string, unknown> } | null,
  profile: UserProfile | { display_name?: string | null; email?: string | null } | null
): boolean {
  if (!user && !profile) return false;

  const email = (user?.email || profile?.email || '').toLowerCase();
  const displayName = (
    profile?.display_name ||
    (user?.user_metadata?.full_name as string) ||
    (user?.user_metadata?.name as string) ||
    (user?.user_metadata?.user_name as string) ||
    ''
  ).toLowerCase();

  return (
    displayName.includes('uurii99') ||
    email.includes('uurii99') ||
    email === 'ovidalg@fp.insjoaquimmir.cat' ||
    localStorage.getItem('is_uurii99_profile') === 'true'
  );
}

export interface ExcelMovementItem {
  amountEuros: number;
  description: string;
}

export interface ExcelExpenseSeed {
  categoryName: string;
  section: BudgetSection;
  amountEuros: number;
  notes?: string;
  items?: ExcelMovementItem[];
}

/**
 * Data extracted directly from TRESORERIA URI.xlsx for the starting month (October 2026)
 */
export const UURII_EXCEL_OCTOBER_2026 = {
  year: 2026,
  month: 10, // Octubre
  incomes: [
    {
      description: 'NÒMINA',
      amountEuros: 723.98,
      type: 'salary' as const,
      date: '2026-10-01',
    },
  ],
  expenses: [
    // 1. Gastos Fijos (40%)
    {
      categoryName: 'GYM - FIJO',
      section: 'fixed' as BudgetSection,
      amountEuros: 49.95,
      notes: 'Cuota mensual gimnasio',
    },
    {
      categoryName: 'CORTE DE PELO',
      section: 'fixed' as BudgetSection,
      amountEuros: 13.00,
      notes: 'Peluquería',
    },
    {
      categoryName: 'OTROS',
      section: 'fixed' as BudgetSection,
      amountEuros: 12.00,
      notes: 'Otros fijos',
    },

    // 2. Gastos Opcionales / Ocio (30%)
    {
      categoryName: 'COMIDAS',
      section: 'leisure' as BudgetSection,
      amountEuros: 18.58,
      notes: 'Desglose: 6 + 3.88 + 1.7 + 7',
      items: [
        { amountEuros: 6.00, description: 'Comida 1' },
        { amountEuros: 3.88, description: 'Comida 2' },
        { amountEuros: 1.70, description: 'Comida 3' },
        { amountEuros: 7.00, description: 'Comida 4' },
      ],
    },
    {
      categoryName: 'REGALS',
      section: 'leisure' as BudgetSection,
      amountEuros: 30.27,
      notes: 'Regalos octubre',
    },
    {
      categoryName: 'PIEZAS MOTO',
      section: 'leisure' as BudgetSection,
      amountEuros: 200.08,
      notes: 'Desglose: 110.58 + 89.5',
      items: [
        { amountEuros: 110.58, description: 'Piezas moto 1' },
        { amountEuros: 89.50, description: 'Piezas moto 2' },
      ],
    },
    {
      categoryName: 'GASOLINA MOTO',
      section: 'leisure' as BudgetSection,
      amountEuros: 13.41,
      notes: 'Desglose: 13.05 + 0.36',
      items: [
        { amountEuros: 13.05, description: 'Gasolina moto' },
        { amountEuros: 0.36, description: 'Ajuste gasolina' },
      ],
    },
    {
      categoryName: 'HOTWHEELS',
      section: 'leisure' as BudgetSection,
      amountEuros: 75.60,
      notes: 'Desglose: 1.5 + 68.1 + 6',
      items: [
        { amountEuros: 1.50, description: 'Hot Wheels 1' },
        { amountEuros: 68.10, description: 'Hot Wheels pack' },
        { amountEuros: 6.00, description: 'Hot Wheels 3' },
      ],
    },

    // 3. Inversión y Ahorro (30%)
    {
      categoryName: 'INVERSIÓ',
      section: 'savings' as BudgetSection,
      amountEuros: 108.60,
      notes: 'Inversión mensual (50% de ahorro)',
    },
    {
      categoryName: 'FONS EMERGENCIA',
      section: 'savings' as BudgetSection,
      amountEuros: 108.60,
      notes: 'Fondo de emergencia (50% de ahorro)',
    },
  ],
};

/**
 * Syncs the TRESORERIA URI data for uurii99_ ONLY.
 * NEVER modifies other users' data under any circumstances.
 */
export async function syncUuriiExcelData(
  user: User | null,
  profile: UserProfile | null,
  force = false
): Promise<{ success: boolean; message: string; count?: number }> {
  if (!user) {
    return { success: false, message: 'No hay usuario autenticado' };
  }

  // Strict check: ONLY execute for uurii99_ profile
  if (!isUuriiProfile(user, profile) && !force) {
    return {
      success: false,
      message: 'Esta sincronización está reservada exclusivamente para el perfil uurii99_',
    };
  }

  const syncKey = `uurii_excel_synced_${user.id}_2026_10`;
  if (!force && localStorage.getItem(syncKey) === 'true') {
    return {
      success: true,
      message: 'Los datos de TRESORERIA URI ya están sincronizados para este mes.',
    };
  }

  try {
    const { year, month, incomes, expenses } = UURII_EXCEL_OCTOBER_2026;

    // 1. Fetch user categories
    const { data: existingCategories } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    const categoryMap = new Map<string, string>(); // lowercase name -> category id
    existingCategories?.forEach((c) => {
      categoryMap.set(c.name.trim().toLowerCase(), c.id);
    });

    // Create any missing categories specifically for this user
    for (const exp of expenses) {
      const lowerName = exp.categoryName.trim().toLowerCase();
      if (!categoryMap.has(lowerName)) {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: exp.categoryName,
            section: exp.section,
            sort_order: categoryMap.size,
          })
          .select()
          .single();

        if (newCat) {
          categoryMap.set(lowerName, newCat.id);
        }
      }
    }

    let insertedCount = 0;

    // 2. Sync Incomes for October 2026
    for (const inc of incomes) {
      const cents = eurosToCents(inc.amountEuros);
      const { data: existingInc } = await supabase
        .from('income_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('budget_month', month)
        .eq('budget_year', year)
        .eq('description', inc.description)
        .limit(1);

      if (!existingInc || existingInc.length === 0) {
        await supabase.from('income_entries').insert({
          user_id: user.id,
          description: inc.description,
          amount: cents,
          income_type: inc.type,
          budget_month: month,
          budget_year: year,
          date: inc.date,
          notes: 'Importado de TRESORERIA URI.xlsx',
        });
        insertedCount++;
      }
    }

    // 3. Sync Expenses for October 2026
    for (const exp of expenses) {
      const catId = categoryMap.get(exp.categoryName.trim().toLowerCase()) || null;

      // Check if transactions already exist for this category & month
      let query = supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('budget_month', month)
        .eq('budget_year', year)
        .eq('type', 'expense');

      if (catId) {
        query = query.eq('category_id', catId);
      } else {
        query = query.eq('description', exp.categoryName);
      }

      const { data: existingTx } = await query;

      if (!existingTx || existingTx.length === 0) {
        // If it has sub-items (like COMIDAS, PIEZAS MOTO, etc.), insert individual items
        // so the CellDetailModal displays the exact itemized breakdown
        if (exp.items && exp.items.length > 0) {
          const txRows = exp.items.map((item, idx) => ({
            user_id: user.id,
            type: 'expense' as const,
            amount: eurosToCents(item.amountEuros),
            description: exp.categoryName,
            category_id: catId,
            section: exp.section,
            budget_month: month,
            budget_year: year,
            date: `2026-10-${String(Math.min(idx + 1, 28)).padStart(2, '0')}`,
            notes: item.description,
          }));
          await supabase.from('transactions').insert(txRows);
          insertedCount += txRows.length;
        } else {
          // Single transaction
          await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'expense',
            amount: eurosToCents(exp.amountEuros),
            description: exp.categoryName,
            category_id: catId,
            section: exp.section,
            budget_month: month,
            budget_year: year,
            date: '2026-10-01',
            notes: exp.notes || 'Importado de TRESORERIA URI.xlsx',
          });
          insertedCount++;
        }
      }
    }

    localStorage.setItem(syncKey, 'true');

    return {
      success: true,
      message: `Excel TRESORERIA URI sincronizado con éxito para Octubre 2026 (${insertedCount} registros procesados).`,
      count: insertedCount,
    };
  } catch (error) {
    console.error('Error syncing uurii excel:', error);
    return {
      success: false,
      message: 'Ocurrió un error al sincronizar los datos de TRESORERIA URI',
    };
  }
}
