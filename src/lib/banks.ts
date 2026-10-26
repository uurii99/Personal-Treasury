import type { BankAccount, BankScheduledDebit, BankAccountPurpose } from '@/types';

const STORAGE_KEY_BANKS = 'pt_bank_accounts_';
const STORAGE_KEY_DEBITS = 'pt_bank_debits_';

export const DEFAULT_BANKS: Omit<BankAccount, 'user_id'>[] = [
  {
    id: 'b-sabadell',
    name: 'Banc Sabadell',
    balance: 85000, // 850,00 €
    purpose: 'fixed',
    interest_rate: '0% TAE',
    color: '#0066B3',
    notes: 'Donde entra la nómina y extras, y de donde se cobra el gym y todo lo fijo.',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b-trade-republic',
    name: 'Trade Republic',
    balance: 200000, // 2.000,00 €
    purpose: 'savings',
    interest_rate: '2% TAE',
    color: '#121212',
    notes: 'Donde tengo la cuenta de emergencia.',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b-revolut',
    name: 'Revolut',
    balance: 42000, // 420,00 €
    purpose: 'leisure',
    interest_rate: '0% TAE',
    color: '#0075EB',
    notes: 'Donde pagaré todos los gastos no fijos.',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b-myinvestor',
    name: 'MyInvestor',
    balance: 150000, // 1.500,00 €
    purpose: 'savings',
    interest_rate: 'Fondos Indexados',
    color: '#8A2BE2',
    notes: 'Donde tengo las inversiones/carteras inversión.',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b-efectivo',
    name: 'Efectivo',
    balance: 6000, // 60,00 €
    purpose: 'cash',
    interest_rate: 'Físico',
    color: '#16A34A',
    notes: 'Efectivo que no cuenta.',
    is_cash: true,
    exclude_from_calculations: true,
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const BANK_CONCEPTS_MAP: Record<string, { label: string; concepts: string[]; typeDesc: string; isExcludedFromLiquidity?: boolean }> = {
  'b-sabadell': {
    label: 'Gastos fijos y nómina (40%)',
    typeDesc: 'Cuenta operativa principal · Se ingresa la nómina y se cargan los recibos fijos',
    concepts: [
      'NÒMINA',
      'GYM - FIJO',
      'ASSEG. MOTO',
      'ITV MOTO',
      'REV./REPARACIONS MOTO',
      'IMPOST CIRCULACIO MOTO',
      'TRANSPORT PÚBLIC',
      'BENZINA MOTO',
      'CORTE DE PELO',
      'OTROS',
    ],
  },
  'b-revolut': {
    label: 'Gastos opcionales y ocio (30%)',
    typeDesc: 'Tarjeta de uso diario · Salidas, compras, restaurantes y caprichos',
    concepts: [
      'SALIDAS/VIAGES',
      'ROPA',
      'COMIDAS',
      'DEPORTES',
      'REGALS',
      'PIEZAS MOTO',
      'GASOLINA MOTO',
      'HOTWHEELS',
    ],
  },
  'b-trade-republic': {
    label: 'Cuenta de Emergencia (2% TAE)',
    typeDesc: 'Fondo de emergencia remunerado · Reserva intocable para imprevistos (no es liquidez operativa)',
    isExcludedFromLiquidity: true,
    concepts: [
      'FONS EMERGENCIA',
      'CUENTA REMUNERADA',
      'RESERVA IMPREVISTOS',
    ],
  },
  'b-myinversor': {
    label: 'Inversión a largo plazo (30%)',
    typeDesc: 'Cartera de inversión indexada · Crecimiento patrimonial (no es liquidez operativa)',
    isExcludedFromLiquidity: true,
    concepts: [
      'INVERSIÓ',
      'FONDOS INDEXADOS',
      'APORTACIONES MENSUALES',
    ],
  },
  'b-efectivo': {
    label: 'Efectivo en mano',
    typeDesc: 'Dinero en efectivo / cartera física (solo informativo, no computa en bancos)',
    isExcludedFromLiquidity: true,
    concepts: [
      'CARTERA FÍSICA',
      'EFECTIVO',
    ],
  },
};

/**
 * Calculates bank liquidity:
 * "todo el dinero, menos, inversiones y cuenta de emergencia"
 */
export function calculateBankLiquidity(accounts: BankAccount[]): {
  totalWealthCents: number;
  investmentsCents: number;
  emergencyFundCents: number;
  liquidityCents: number;
  cashCents: number;
  sabadellCents: number;
  revolutCents: number;
} {
  let totalWealthCents = 0;
  let investmentsCents = 0;
  let emergencyFundCents = 0;
  let cashCents = 0;
  let sabadellCents = 0;
  let revolutCents = 0;

  accounts.forEach((acc) => {
    const isCash =
      acc.is_cash ||
      acc.exclude_from_calculations ||
      acc.purpose === 'cash' ||
      acc.name.trim().toLowerCase() === 'efectivo';

    if (isCash) {
      cashCents += acc.balance || 0;
      return;
    }

    const bId = acc.id.toLowerCase();
    const bName = acc.name.toLowerCase();

    totalWealthCents += acc.balance || 0;

    if (
      bId.includes('myinvestor') ||
      bId.includes('myinversor') ||
      bName.includes('myinvestor') ||
      bName.includes('myinversor') ||
      bName.includes('invers')
    ) {
      investmentsCents += acc.balance || 0;
    } else if (bId.includes('trade') || bName.includes('trade') || bName.includes('emergencia')) {
      emergencyFundCents += acc.balance || 0;
    } else if (bId.includes('sabadell') || bName.includes('sabadell')) {
      sabadellCents += acc.balance || 0;
    } else if (bId.includes('revolut') || bName.includes('revolut')) {
      revolutCents += acc.balance || 0;
    } else if (acc.purpose === 'fixed') {
      sabadellCents += acc.balance || 0;
    } else if (acc.purpose === 'leisure') {
      revolutCents += acc.balance || 0;
    } else if (acc.purpose === 'savings') {
      investmentsCents += acc.balance || 0;
    }
  });

  // Liquidez = Todo el dinero menos inversiones y cuenta de emergencia
  const liquidityCents = Math.max(0, totalWealthCents - investmentsCents - emergencyFundCents);

  return {
    totalWealthCents,
    investmentsCents,
    emergencyFundCents,
    liquidityCents,
    cashCents,
    sabadellCents,
    revolutCents,
  };
}

/**
 * Automatically updates bank balances when any income or expense is added or modified.
 */
export function recordMovementInBank(
  userId: string,
  movement: {
    type: 'income' | 'expense';
    amountCents?: number;
    amount?: number;
    section?: BankAccountPurpose | 'fixed' | 'leisure' | 'savings';
    categoryName?: string;
    concept?: string;
    description?: string;
    bank?: string;
    operation?: 'add' | 'remove';
  }
) {
  const value = movement.amountCents ?? movement.amount ?? 0;
  if (!userId || value <= 0) return;

  const accounts = getBankAccounts(userId);
  const factor = movement.operation === 'remove' ? -1 : 1;
  const isIncome = movement.type === 'income';

  let targetId = 'b-sabadell';
  const desc = (movement.description || movement.concept || movement.categoryName || '').toLowerCase();
  const bankHint = (movement.bank || '').toLowerCase();

  if (bankHint.includes('revolut')) {
    targetId = 'b-revolut';
  } else if (bankHint.includes('trade')) {
    targetId = 'b-trade-republic';
  } else if (bankHint.includes('invers')) {
    targetId = 'b-myinversor';
  } else if (bankHint.includes('sabadell')) {
    targetId = 'b-sabadell';
  } else if (isIncome) {
    targetId = 'b-sabadell'; // Salary / primary income goes into Sabadell
  } else {
    // Expense
    if (desc.includes('invers') || desc.includes('indexad')) {
      targetId = 'b-myinversor';
    } else if (desc.includes('emergencia') || desc.includes('fons')) {
      targetId = 'b-trade-republic';
    } else if (
      movement.section === 'leisure' ||
      desc.includes('comida') ||
      desc.includes('ropa') ||
      desc.includes('hotwheel') ||
      desc.includes('gasolina') ||
      desc.includes('regal') ||
      desc.includes('viaje') ||
      desc.includes('salida') ||
      desc.includes('pieza') ||
      desc.includes('deporte')
    ) {
      targetId = 'b-revolut';
    } else {
      // Fixed expense (Sabadell)
      targetId = 'b-sabadell';
    }
  }

  const updated = accounts.map((acc) => {
    const isTarget = acc.id === targetId || acc.name.toLowerCase().includes(targetId.replace('b-', ''));
    if (isTarget) {
      const delta = isIncome ? value * factor : -value * factor;
      return {
        ...acc,
        balance: Math.max(0, acc.balance + delta),
        updated_at: new Date().toISOString(),
      };
    }
    return acc;
  });

  saveBankAccounts(userId, updated);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bank-accounts-updated'));
  }
}

export const DEFAULT_SCHEDULED_DEBITS: BankScheduledDebit[] = [
  {
    id: 'deb-asseg-moto',
    bank_id: 'b-sabadell',
    title: 'Seguro Moto',
    amount: 65000, // 650,00 €
    due_day: 15,
    recurrence: 'annual',
    category_name: 'ASSEG. MOTO',
    notes: 'Cobro anual del seguro de la moto. Mantener saldo mínimo.',
  },
  {
    id: 'deb-gym',
    bank_id: 'b-sabadell',
    title: 'Cuota Gimnasio',
    amount: 4995, // 49,95 €
    due_day: 1,
    recurrence: 'monthly',
    category_name: 'GYM - FIJO',
    notes: 'Recibo mensual a primero de mes.',
  },
];

export function getBankAccounts(userId: string): BankAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BANKS + userId);
    if (!raw) {
      const initial = DEFAULT_BANKS.map((b) => ({ ...b, user_id: userId }));
      saveBankAccounts(userId, initial);
      return initial;
    }
    let list: BankAccount[] = JSON.parse(raw);
    let changed = false;

    // Migrate MyInversor -> MyInvestor and update default notes if needed
    list = list.map((b) => {
      let updated = { ...b };
      if (b.name === 'MyInversor' || b.id === 'b-myinversor') {
        updated.name = 'MyInvestor';
        updated.id = 'b-myinvestor';
        changed = true;
      }
      if (b.name.toLowerCase().includes('sabadell') && (!b.notes || b.notes.includes('principal para nómina'))) {
        updated.notes = 'Donde entra la nómina y extras, y de donde se cobra el gym y todo lo fijo.';
        changed = true;
      }
      if (b.name.toLowerCase().includes('trade') && (!b.notes || b.notes.includes('remunerada de ahorro'))) {
        updated.notes = 'Donde tengo la cuenta de emergencia.';
        changed = true;
      }
      if (b.name.toLowerCase().includes('revolut') && (!b.notes || b.notes.includes('para ocio, restaurantes'))) {
        updated.notes = 'Donde pagaré todos los gastos no fijos.';
        changed = true;
      }
      if ((b.name.toLowerCase().includes('myinvestor') || b.name.toLowerCase().includes('myinversor')) && (!b.notes || b.notes.includes('Aportación mensual'))) {
        updated.notes = 'Donde tengo las inversiones/carteras inversión.';
        changed = true;
      }
      if ((b.is_cash || b.name.toLowerCase() === 'efectivo') && (!b.notes || b.notes.includes('Dinero en efectivo'))) {
        updated.notes = 'Efectivo que no cuenta.';
        changed = true;
      }
      return updated;
    });

    // Ensure Efectivo exists for existing users
    const hasCash = list.some(
      (b) => b.is_cash || b.id === 'b-efectivo' || b.name.trim().toLowerCase() === 'efectivo'
    );
    if (!hasCash) {
      list.push({
        id: 'b-efectivo',
        user_id: userId,
        name: 'Efectivo',
        balance: 6000,
        purpose: 'cash',
        interest_rate: 'Físico',
        color: '#16A34A',
        notes: 'Efectivo que no cuenta.',
        is_cash: true,
        exclude_from_calculations: true,
        last_reconciled_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      changed = true;
    }

    if (changed) {
      saveBankAccounts(userId, list);
    }
    return list;
  } catch {
    return DEFAULT_BANKS.map((b) => ({ ...b, user_id: userId }));
  }
}

export function saveBankAccounts(userId: string, accounts: BankAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BANKS + userId, JSON.stringify(accounts));
  } catch (e) {
    console.error('Error saving bank accounts to localStorage:', e);
  }
}

export function getScheduledDebits(userId: string): BankScheduledDebit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEBITS + userId);
    if (!raw) {
      saveScheduledDebits(userId, DEFAULT_SCHEDULED_DEBITS);
      return DEFAULT_SCHEDULED_DEBITS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_SCHEDULED_DEBITS;
  }
}

export function saveScheduledDebits(userId: string, debits: BankScheduledDebit[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEBITS + userId, JSON.stringify(debits));
  } catch (e) {
    console.error('Error saving scheduled debits to localStorage:', e);
  }
}

export interface CalendarEmailAlertSettings {
  enabled: boolean;
  email: string;
  daysAdvance: number;
}

const STORAGE_KEY_EMAIL_ALERTS = 'pt_email_alerts_';

export function getEmailAlertSettings(userId: string, defaultEmail = ''): CalendarEmailAlertSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EMAIL_ALERTS + userId);
    if (!raw) {
      return {
        enabled: true,
        email: defaultEmail || '',
        daysAdvance: 3,
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      enabled: true,
      email: defaultEmail || '',
      daysAdvance: 3,
    };
  }
}

export function saveEmailAlertSettings(userId: string, settings: CalendarEmailAlertSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY_EMAIL_ALERTS + userId, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving email alert settings:', e);
  }
}
