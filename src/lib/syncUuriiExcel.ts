import { supabase } from '@/lib/supabase';
import { GASSTOS_BANK_MOVEMENTS } from '@/data/gasstos2026';
import type { User } from '@supabase/supabase-js';
import type { UserProfile, BudgetSection } from '@/types';
import { getBankAccounts, saveBankAccounts } from '@/lib/banks';

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
    displayName.includes('uurii') ||
    email.includes('uurii') ||
    email === 'ovidalg@fp.insjoaquimmir.cat' ||
    localStorage.getItem('is_uurii99_profile') === 'true'
  );
}

const ALL_STANDARD_CATEGORIES: { name: string; section: BudgetSection }[] = [
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

/**
 * Syncs the entire GASSTOS.xls bank statement (336 verified movements for 2026) for uurii99_ ONLY.
 * Strictly ignores and NEVER modifies other users' data.
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

  const syncKey = `uurii_gasstos_synced_${user.id}_v6`;
  if (!force && localStorage.getItem(syncKey) === 'true') {
    return {
      success: true,
      message: 'El extracto de GASSTOS.xls ya está completamente sincronizado.',
    };
  }

  try {
    // 1. Purge legacy mock items & duplicate categories (duplicate gym, sports, old hotwheels names)
    const unwantedMock = [
      'Hot Wheels 1',
      'Hot Wheels pack',
      'Hot Wheels 3',
      'Otros fijos',
      'Hot Wheels 2',
      'Piezas moto 1',
      'Piezas moto 2',
    ];

    for (const desc of unwantedMock) {
      await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .ilike('description', desc);
    }

    const unwantedCats = ['Otros fijos', 'DEPORTES', 'GYM', 'Gimnasio', 'GASOLINA MOTO', 'HOTWHEELS', 'REGALS'];
    for (const c of unwantedCats) {
      await supabase.from('categories').delete().eq('user_id', user.id).ilike('name', c);
    }

    // 2. Fetch or create all standard categories for this user
    const { data: existingCats } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id);

    const categoryMap = new Map<string, string>(); // lowercase name -> category id
    existingCats?.forEach((c) => {
      if (!unwantedCats.some((u) => u.toLowerCase() === c.name.trim().toLowerCase())) {
        categoryMap.set(c.name.trim().toLowerCase(), c.id);
      }
    });

    for (let i = 0; i < ALL_STANDARD_CATEGORIES.length; i++) {
      const cat = ALL_STANDARD_CATEGORIES[i];
      const lower = cat.name.trim().toLowerCase();
      if (!categoryMap.has(lower)) {
        const { data: newCat } = await supabase
          .from('categories')
          .insert({
            user_id: user.id,
            name: cat.name,
            section: cat.section,
            sort_order: i,
          })
          .select()
          .single();

        if (newCat) {
          categoryMap.set(lower, newCat.id);
        }
      }
    }

    // 3. Clear existing 2026 transactions and income entries to ensure clean overwrite from GASSTOS.xls
    await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id)
      .eq('budget_year', 2026);

    await supabase
      .from('income_entries')
      .delete()
      .eq('user_id', user.id)
      .eq('budget_year', 2026);

    // 4. Prepare batch records from GASSTOS_BANK_MOVEMENTS
    const incomeRecords = GASSTOS_BANK_MOVEMENTS
      .filter((m) => m.type === 'income')
      .map((m) => ({
        user_id: user.id,
        description: m.concept || 'EXTRES',
        amount: m.amountCents,
        income_type: m.incomeType || 'other',
        budget_month: m.month,
        budget_year: m.year,
        date: m.isoDate,
        notes: JSON.stringify({ bank: 'Banc Sabadell', rawConcept: m.rawConcept }),
      }));

    const expenseRecords = GASSTOS_BANK_MOVEMENTS
      .filter((m) => m.type === 'expense')
      .map((m) => {
        const catKey = (m.category || 'OTROS').trim().toLowerCase();
        const catId = categoryMap.get(catKey) || categoryMap.get('otros') || null;
        return {
          user_id: user.id,
          type: 'expense' as const,
          amount: m.amountCents,
          description: m.rawConcept,
          category_id: catId,
          section: (m.section || 'leisure') as BudgetSection,
          budget_month: m.month,
          budget_year: m.year,
          date: m.isoDate,
          notes: JSON.stringify({ bank: 'Banc Sabadell' }),
        };
      });

    // 5. Insert in chunks of 50 to avoid query size limits
    const CHUNK_SIZE = 50;

    for (let i = 0; i < incomeRecords.length; i += CHUNK_SIZE) {
      const chunk = incomeRecords.slice(i, i + CHUNK_SIZE);
      const { error: incErr } = await supabase.from('income_entries').insert(chunk);
      if (incErr) {
        console.error('Error inserting income chunk:', incErr);
      }
    }

    for (let i = 0; i < expenseRecords.length; i += CHUNK_SIZE) {
      const chunk = expenseRecords.slice(i, i + CHUNK_SIZE);
      const { error: expErr } = await supabase.from('transactions').insert(chunk);
      if (expErr) {
        console.error('Error inserting expense chunk:', expErr);
      }
    }

    // 6. Update bank account balances: Sabadell (1.001,32 €), Fondo Emergencia (2.558,77 €), MyInvestor (0 €)
    const sabadellSaldoCents = 100132;
    const emergencySaldoCents = 255877;

    try {
      // Local storage accounts update
      const localAccs = getBankAccounts(user.id);
      const updatedLocal = localAccs.map((acc) => {
        if (acc.name.toLowerCase().includes('sabadell')) {
          return { ...acc, balance: sabadellSaldoCents, updated_at: new Date().toISOString() };
        }
        if (acc.name.toLowerCase().includes('trade') || acc.name.toLowerCase().includes('emergencia')) {
          return { ...acc, balance: emergencySaldoCents, updated_at: new Date().toISOString() };
        }
        if (acc.name.toLowerCase().includes('myinvestor') || acc.name.toLowerCase().includes('invers')) {
          return { ...acc, balance: 0, updated_at: new Date().toISOString() };
        }
        return acc;
      });
      saveBankAccounts(user.id, updatedLocal);

      // Supabase bank_accounts table update if available
      const { data: bankAccs } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id);

      if (bankAccs && bankAccs.length > 0) {
        for (const b of bankAccs) {
          const lower = b.name?.toLowerCase() || '';
          if (lower.includes('sabadell')) {
            await supabase.from('bank_accounts').update({ balance_cents: sabadellSaldoCents, updated_at: new Date().toISOString() }).eq('id', b.id);
          } else if (lower.includes('trade') || lower.includes('emergencia')) {
            await supabase.from('bank_accounts').update({ balance_cents: emergencySaldoCents, updated_at: new Date().toISOString() }).eq('id', b.id);
          } else if (lower.includes('myinvestor') || lower.includes('invers')) {
            await supabase.from('bank_accounts').update({ balance_cents: 0, updated_at: new Date().toISOString() }).eq('id', b.id);
          }
        }
      }
    } catch {
      // Ignore if bank_accounts table is not present
    }

    localStorage.setItem(syncKey, 'true');
    window.dispatchEvent(new CustomEvent('excel-data-updated'));
    window.dispatchEvent(new CustomEvent('bank-accounts-updated'));

    return {
      success: true,
      message: `Extracto GASSTOS.xls sincronizado con éxito (${GASSTOS_BANK_MOVEMENTS.length} movimientos de 2026).`,
      count: GASSTOS_BANK_MOVEMENTS.length,
    };
  } catch (error) {
    console.error('Error syncing GASSTOS.xls:', error);
    return {
      success: false,
      message: 'Ocurrió un error al sincronizar los datos de GASSTOS.xls',
    };
  }
}
