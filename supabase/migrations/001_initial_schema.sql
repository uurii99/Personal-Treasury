-- =============================================================================
-- Personal Treasury - Database Schema
-- Migration: 001_initial_schema.sql
-- Description: Creates all tables, indexes, and RLS policies
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- PROFILES
-- =============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  currency TEXT NOT NULL DEFAULT 'EUR',
  locale TEXT NOT NULL DEFAULT 'es-ES',
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- USER SETTINGS
-- =============================================================================
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  fixed_percentage NUMERIC(5,2) NOT NULL DEFAULT 40.00,
  leisure_percentage NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  savings_percentage NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  initial_balance BIGINT NOT NULL DEFAULT 0, -- cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT percentages_sum_100 CHECK (fixed_percentage + leisure_percentage + savings_percentage = 100.00),
  CONSTRAINT percentages_non_negative CHECK (fixed_percentage >= 0 AND leisure_percentage >= 0 AND savings_percentage >= 0)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "settings_insert_own" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update_own" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "settings_delete_own" ON user_settings FOR DELETE USING (auth.uid() = user_id);

-- Auto-create settings on profile creation
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================================================
-- CATEGORIES
-- =============================================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section TEXT NOT NULL CHECK (section IN ('fixed', 'leisure', 'savings')),
  icon TEXT,
  color TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_user ON categories(user_id);
CREATE INDEX idx_categories_section ON categories(user_id, section);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON categories FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- INCOME ENTRIES
-- =============================================================================
CREATE TABLE income_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0), -- cents
  date DATE NOT NULL,
  income_type TEXT NOT NULL DEFAULT 'other',
  budget_month INTEGER NOT NULL CHECK (budget_month BETWEEN 1 AND 12),
  budget_year INTEGER NOT NULL CHECK (budget_year > 2000),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_income_user_month ON income_entries(user_id, budget_year, budget_month);

ALTER TABLE income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_select_own" ON income_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "income_insert_own" ON income_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "income_update_own" ON income_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "income_delete_own" ON income_entries FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- TRANSACTIONS (expenses, income records, transfers)
-- =============================================================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
  amount BIGINT NOT NULL CHECK (amount > 0), -- cents
  description TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  section TEXT NOT NULL CHECK (section IN ('fixed', 'leisure', 'savings')),
  date DATE NOT NULL,
  budget_month INTEGER NOT NULL CHECK (budget_month BETWEEN 1 AND 12),
  budget_year INTEGER NOT NULL CHECK (budget_year > 2000),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_month ON transactions(user_id, budget_year, budget_month);
CREATE INDEX idx_transactions_section ON transactions(user_id, section);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_date ON transactions(user_id, date DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transactions_select_own" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- BUDGET ALLOCATIONS (historical record of monthly budgets)
-- =============================================================================
CREATE TABLE budget_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year > 2000),
  total_income BIGINT NOT NULL DEFAULT 0, -- cents
  fixed_percentage NUMERIC(5,2) NOT NULL,
  leisure_percentage NUMERIC(5,2) NOT NULL,
  savings_percentage NUMERIC(5,2) NOT NULL,
  fixed_amount BIGINT NOT NULL DEFAULT 0, -- cents
  leisure_amount BIGINT NOT NULL DEFAULT 0, -- cents
  savings_amount BIGINT NOT NULL DEFAULT 0, -- cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allocations_select_own" ON budget_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "allocations_insert_own" ON budget_allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allocations_update_own" ON budget_allocations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "allocations_delete_own" ON budget_allocations FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RECURRING EXPENSES
-- =============================================================================
CREATE TABLE recurring_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_amount BIGINT NOT NULL CHECK (total_amount > 0), -- cents
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'semiannual', 'annual', 'one_time')),
  start_date DATE NOT NULL,
  end_date DATE,
  num_installments INTEGER NOT NULL DEFAULT 1 CHECK (num_installments > 0),
  section TEXT NOT NULL CHECK (section IN ('fixed', 'leisure', 'savings')),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_user ON recurring_expenses(user_id);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_select_own" ON recurring_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_insert_own" ON recurring_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_update_own" ON recurring_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring_delete_own" ON recurring_expenses FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RECURRING EXPENSE INSTALLMENTS
-- =============================================================================
CREATE TABLE recurring_expense_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_expense_id UUID NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year > 2000),
  amount BIGINT NOT NULL CHECK (amount > 0), -- cents
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  paid_date DATE,
  paid_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installments_recurring ON recurring_expense_installments(recurring_expense_id);
CREATE INDEX idx_installments_user_month ON recurring_expense_installments(user_id, year, month);

ALTER TABLE recurring_expense_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installments_select_own" ON recurring_expense_installments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "installments_insert_own" ON recurring_expense_installments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "installments_update_own" ON recurring_expense_installments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "installments_delete_own" ON recurring_expense_installments FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- SAVINGS GOALS
-- =============================================================================
CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount BIGINT NOT NULL CHECK (target_amount > 0), -- cents
  current_amount BIGINT NOT NULL DEFAULT 0, -- cents
  target_date DATE,
  icon TEXT,
  color TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_savings_goals_user ON savings_goals(user_id);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_own" ON savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_own" ON savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete_own" ON savings_goals FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- SAVINGS GOAL CONTRIBUTIONS
-- =============================================================================
CREATE TABLE savings_goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  savings_goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- cents, can be negative for withdrawals
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contributions_goal ON savings_goal_contributions(savings_goal_id);
CREATE INDEX idx_contributions_user ON savings_goal_contributions(user_id);

ALTER TABLE savings_goal_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contributions_select_own" ON savings_goal_contributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "contributions_insert_own" ON savings_goal_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contributions_update_own" ON savings_goal_contributions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "contributions_delete_own" ON savings_goal_contributions FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- BUDGET TRANSFERS
-- =============================================================================
CREATE TABLE budget_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_section TEXT NOT NULL CHECK (from_section IN ('fixed', 'leisure', 'savings')),
  to_section TEXT NOT NULL CHECK (to_section IN ('fixed', 'leisure', 'savings')),
  amount BIGINT NOT NULL CHECK (amount > 0), -- cents
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL,
  budget_month INTEGER NOT NULL CHECK (budget_month BETWEEN 1 AND 12),
  budget_year INTEGER NOT NULL CHECK (budget_year > 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_sections CHECK (from_section != to_section)
);

CREATE INDEX idx_transfers_user_month ON budget_transfers(user_id, budget_year, budget_month);

ALTER TABLE budget_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select_own" ON budget_transfers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transfers_insert_own" ON budget_transfers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transfers_update_own" ON budget_transfers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transfers_delete_own" ON budget_transfers FOR DELETE USING (auth.uid() = user_id);
