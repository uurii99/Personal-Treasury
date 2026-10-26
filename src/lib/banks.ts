import type { BankAccount, BankScheduledDebit } from '@/types';

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
    notes: 'Cuenta principal para nómina y gastos fijos (alquiler, seguros, suministros)',
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
    notes: 'Tarjeta para ocio, restaurantes, compras, viajes y gasolina',
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
    notes: 'Cuenta remunerada de ahorro y liquidez al 2% TAE',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'b-myinversor',
    name: 'MyInversor',
    balance: 150000, // 1.500,00 €
    purpose: 'savings',
    interest_rate: 'Fondos Indexados',
    color: '#8A2BE2',
    notes: 'Aportación mensual para inversión a largo plazo',
    last_reconciled_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const DEFAULT_SCHEDULED_DEBITS: BankScheduledDebit[] = [
  {
    id: 'deb-seguro-moto',
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
    return JSON.parse(raw);
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
