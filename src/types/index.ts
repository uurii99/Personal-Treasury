// ===== CORE TYPES =====

// === Auth & User ===
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  currency: string;
  locale: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  fixed_percentage: number;
  leisure_percentage: number;
  savings_percentage: number;
  initial_balance: number; // stored in cents
  created_at: string;
  updated_at: string;
}

// === Budget Categories ===
export type BudgetSection = 'fixed' | 'leisure' | 'savings';

export const BUDGET_SECTION_LABELS: Record<BudgetSection, string> = {
  fixed: 'Gastos fijos',
  leisure: 'Ocio y gastos variables',
  savings: 'Ahorros e inversiones',
};

export const BUDGET_SECTION_COLORS: Record<BudgetSection, string> = {
  fixed: 'brand',
  leisure: 'warning',
  savings: 'savings',
};

export interface Category {
  id: string;
  user_id: string;
  name: string;
  section: BudgetSection;
  icon: string | null;
  color: string | null;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// === Income ===
export type IncomeType =
  | 'salary'
  | 'bonus'
  | 'wallapop'
  | 'tips'
  | 'refund'
  | 'other';

export const INCOME_TYPE_LABELS: Record<IncomeType, string> = {
  salary: 'Nómina',
  bonus: 'Paga extraordinaria',
  wallapop: 'Venta en Wallapop',
  tips: 'Propinas',
  refund: 'Reembolso',
  other: 'Otros ingresos',
};

export interface IncomeEntry {
  id: string;
  user_id: string;
  description: string;
  amount: number; // stored in cents
  date: string;
  income_type: IncomeType;
  budget_month: number; // 1-12
  budget_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// === Transactions ===
export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number; // stored in cents
  description: string;
  category_id: string | null;
  section: BudgetSection;
  date: string;
  budget_month: number;
  budget_year: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  category?: Category;
}

// === Budget Allocations ===
export interface BudgetAllocation {
  id: string;
  user_id: string;
  month: number;
  year: number;
  total_income: number; // cents
  fixed_percentage: number;
  leisure_percentage: number;
  savings_percentage: number;
  fixed_amount: number; // cents
  leisure_amount: number; // cents
  savings_amount: number; // cents
  created_at: string;
  updated_at: string;
}

// === Recurring Expenses ===
export type RecurrenceFrequency =
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'one_time';

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  one_time: 'Puntual',
};

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  total_amount: number; // cents
  frequency: RecurrenceFrequency;
  start_date: string;
  end_date: string | null;
  num_installments: number;
  section: BudgetSection;
  category_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  category?: Category;
  installments?: RecurringExpenseInstallment[];
}

export interface RecurringExpenseInstallment {
  id: string;
  recurring_expense_id: string;
  user_id: string;
  month: number;
  year: number;
  amount: number; // cents
  is_paid: boolean;
  paid_date: string | null;
  paid_transaction_id: string | null;
  created_at: string;
}

// === Savings Goals ===
export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number; // cents
  current_amount: number; // cents
  target_date: string | null;
  icon: string | null;
  color: string | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface SavingsGoalContribution {
  id: string;
  savings_goal_id: string;
  user_id: string;
  amount: number; // cents (can be negative for withdrawals)
  description: string;
  date: string;
  created_at: string;
}

// === Budget Transfers ===
export interface BudgetTransfer {
  id: string;
  user_id: string;
  from_section: BudgetSection;
  to_section: BudgetSection;
  amount: number; // cents
  description: string;
  date: string;
  budget_month: number;
  budget_year: number;
  created_at: string;
}

// === UI Types ===
export interface MonthYear {
  month: number;
  year: number;
}

export interface MonthlySummary {
  totalIncome: number;
  salaryIncome: number;
  extraIncome: number;
  totalExpenses: number;
  fixedExpenses: number;
  leisureExpenses: number;
  savingsContributions: number;
  fixedBudget: number;
  leisureBudget: number;
  savingsBudget: number;
  fixedAvailable: number;
  leisureAvailable: number;
  savingsAvailable: number;
  totalAvailable: number;
  totalSaved: number;
}

export interface AnnualMonthCard {
  month: number;
  year: number;
  income: number;
  expenses: number;
  budget: number;
  savings: number;
  available: number;
}

// === Toast / Notifications ===
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}
