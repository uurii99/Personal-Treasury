import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2,
  Plus,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  Sparkles,
  ShieldCheck,
  Banknote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button, Input, Select, Modal } from '@/components/ui';
import { formatCurrency, eurosToCents, centsToEuros } from '@/lib/money';
import {
  getBankAccounts,
  saveBankAccounts,
  getScheduledDebits,
  saveScheduledDebits,
} from '@/lib/banks';
import { BankLogo } from '@/components/banks/BankLogo';
import type { BankAccount, BankScheduledDebit, BankAccountPurpose } from '@/types';

export function BanksPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { t } = useLanguage();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [debits, setDebits] = useState<BankScheduledDebit[]>([]);

  // Account modal
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountPurpose, setAccountPurpose] = useState<BankAccountPurpose>('fixed');
  const [accountInterest, setAccountInterest] = useState('');
  const [accountNotes, setAccountNotes] = useState('');

  // Debit modal
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [debitTitle, setDebitTitle] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitBankId, setDebitBankId] = useState('');
  const [debitDay, setDebitDay] = useState(15);
  const [debitRecurrence, setDebitRecurrence] = useState<'monthly' | 'annual' | 'one_time'>('annual');

  // Quick balance inline edit
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineAmount, setInlineAmount] = useState('');

  const loadData = useCallback(() => {
    if (!user) return;
    const b = getBankAccounts(user.id);
    const d = getScheduledDebits(user.id);
    setAccounts(b);
    setDebits(d);
    if (b.length > 0 && !debitBankId) {
      setDebitBankId(b[0].id);
    }
  }, [user, debitBankId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total balance in bank accounts (Excludes cash: "que ese no contara para nada, solo para tenerlo presente")
  const totalBalanceCents = useMemo(() => {
    return accounts
      .filter((acc) => !acc.is_cash && !acc.exclude_from_calculations && acc.purpose !== 'cash' && acc.name.trim().toLowerCase() !== 'efectivo')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Cash balance specifically for tracking physical money without counting in bank totals
  const cashBalanceCents = useMemo(() => {
    return accounts
      .filter((acc) => acc.is_cash || acc.exclude_from_calculations || acc.purpose === 'cash' || acc.name.trim().toLowerCase() === 'efectivo')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);
  }, [accounts]);

  // Balance by purpose
  const balanceByPurpose = useMemo(() => {
    const res: Record<BankAccountPurpose, number> = { fixed: 0, leisure: 0, savings: 0, mixed: 0, cash: 0 };
    accounts.forEach((a) => {
      res[a.purpose] = (res[a.purpose] || 0) + a.balance;
    });
    return res;
  }, [accounts]);

  // Handle save account
  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = accountName.trim();
    if (!trimmed) {
      showError('Introduce el nombre del banco');
      return;
    }

    const parsed = parseFloat(accountBalance.replace(',', '.'));
    const cents = isNaN(parsed) || parsed < 0 ? 0 : eurosToCents(parsed);
    const isCashAccount = accountPurpose === 'cash' || trimmed.toLowerCase() === 'efectivo';

    let updated: BankAccount[];
    if (editingAccount) {
      updated = accounts.map((a) =>
        a.id === editingAccount.id
          ? {
              ...a,
              name: trimmed,
              balance: cents,
              purpose: accountPurpose,
              interest_rate: accountInterest.trim() || (isCashAccount ? 'Físico' : null),
              notes: accountNotes.trim() || null,
              is_cash: isCashAccount,
              exclude_from_calculations: isCashAccount,
              updated_at: new Date().toISOString(),
            }
          : a
      );
      success('Cuenta actualizada', trimmed);
    } else {
      const newAcc: BankAccount = {
        id: isCashAccount ? 'b-efectivo' : 'bank_' + Date.now(),
        user_id: user.id,
        name: trimmed,
        balance: cents,
        purpose: accountPurpose,
        interest_rate: accountInterest.trim() || (isCashAccount ? 'Físico' : null),
        notes: accountNotes.trim() || null,
        is_cash: isCashAccount,
        exclude_from_calculations: isCashAccount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_reconciled_at: new Date().toISOString(),
      };
      updated = [...accounts, newAcc];
      success('Cuenta añadida', trimmed);
    }

    saveBankAccounts(user.id, updated);
    setAccounts(updated);
    setShowAccountModal(false);
    setEditingAccount(null);
  };

  const handleDeleteAccount = (id: string) => {
    if (!user) return;
    const updated = accounts.filter((a) => a.id !== id);
    saveBankAccounts(user.id, updated);
    setAccounts(updated);
    success('Cuenta eliminada');
  };

  const handleOpenEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc);
    setAccountName(acc.name);
    setAccountBalance(centsToEuros(acc.balance).toString().replace('.', ','));
    setAccountPurpose(acc.purpose);
    setAccountInterest(acc.interest_rate || '');
    setAccountNotes(acc.notes || '');
    setShowAccountModal(true);
  };

  const handleOpenNewAccount = () => {
    setEditingAccount(null);
    setAccountName('');
    setAccountBalance('');
    setAccountPurpose('fixed');
    setAccountInterest('');
    setAccountNotes('');
    setShowAccountModal(true);
  };

  // Quick inline balance change
  const handleSaveInlineBalance = (acc: BankAccount) => {
    if (!user) return;
    const parsed = parseFloat(inlineAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      showError('Importe inválido');
      return;
    }
    const cents = eurosToCents(parsed);
    const updated = accounts.map((a) =>
      a.id === acc.id
        ? {
            ...a,
            balance: cents,
            last_reconciled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : a
    );
    saveBankAccounts(user.id, updated);
    setAccounts(updated);
    setInlineEditingId(null);
    success('Saldo actualizado y cuadrado', `${acc.name}: ${parsed.toFixed(2)} €`);
  };

  // Reconcile all accounts button
  const handleReconcileAll = () => {
    if (!user) return;
    const updated = accounts.map((a) => ({
      ...a,
      last_reconciled_at: new Date().toISOString(),
    }));
    saveBankAccounts(user.id, updated);
    setAccounts(updated);
    success('Recuento registrado', 'Todos los saldos han quedado verificados a fecha de hoy.');
  };

  // Save scheduled debit
  const handleSaveDebit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmed = debitTitle.trim();
    if (!trimmed) {
      showError('Introduce el nombre del recibo o gasto previsto');
      return;
    }
    const parsed = parseFloat(debitAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      showError('Introduce un importe válido');
      return;
    }

    const newDeb: BankScheduledDebit = {
      id: 'deb_' + Date.now(),
      bank_id: debitBankId,
      title: trimmed,
      amount: eurosToCents(parsed),
      due_day: debitDay,
      recurrence: debitRecurrence,
    };

    const updated = [...debits, newDeb];
    saveScheduledDebits(user.id, updated);
    setDebits(updated);
    setShowDebitModal(false);
    setDebitTitle('');
    setDebitAmount('');
    success('Aviso programado', `${trimmed} (${parsed.toFixed(2)} €)`);
  };

  const handleDeleteDebit = (id: string) => {
    if (!user) return;
    const updated = debits.filter((d) => d.id !== id);
    saveScheduledDebits(user.id, updated);
    setDebits(updated);
    success('Aviso eliminado');
  };

  // Helper purpose label
  const getPurposeBadge = (purpose: BankAccountPurpose, isCash?: boolean) => {
    if (purpose === 'cash' || isCash) {
      return {
        label: t.banks.purposeCash,
        color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold',
      };
    }
    switch (purpose) {
      case 'fixed':
        return { label: t.banks.purposeFixed, color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' };
      case 'leisure':
        return { label: t.banks.purposeLeisure, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'savings':
        return { label: t.banks.purposeSavings, color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' };
      case 'mixed':
      default:
        return { label: t.banks.purposeMixed, color: 'bg-surface-200 text-surface-800 dark:bg-surface-800 dark:text-surface-200' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{t.banks.title}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
              Patrimonio Real
            </span>
          </div>
          <p className="text-sm text-surface-500 mt-1">{t.banks.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={handleReconcileAll}>
            {t.banks.doRecount}
          </Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={handleOpenNewAccount}>
            {t.banks.addAccount}
          </Button>
        </div>
      </div>

      {/* Global wealth banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#107c41] to-emerald-800 text-white p-5 rounded-2xl shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <Building2 className="w-32 h-32" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              {t.banks.totalBalance}
            </span>
            <p className="text-3xl font-extrabold font-mono tabular-nums mt-1 tracking-tight">
              {formatCurrency(totalBalanceCents)}
            </p>
          </div>
          <p className="text-xs text-emerald-100 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-300 shrink-0" />
            <span>Suma de cuentas bancarias (no incluye efectivo).</span>
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-surface-500 font-medium">Asignación Fijos / Ocio</span>
            <div className="space-y-1.5 mt-2">
              <div className="flex justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-medium">Fijos (Sabadell):</span>
                <span className="font-mono font-bold">{formatCurrency(balanceByPurpose.fixed)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-medium">Ocio (Revolut):</span>
                <span className="font-mono font-bold">{formatCurrency(balanceByPurpose.leisure)}</span>
              </div>
            </div>
          </div>
          <span className="text-[11px] text-surface-400 mt-2">Corresponde al 40% y 30%</span>
        </div>

        <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs text-surface-500 font-medium">Ahorro e Inversión (30%)</span>
            <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
              {formatCurrency(balanceByPurpose.savings)}
            </p>
          </div>
          <p className="text-xs text-surface-500 mt-2 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500 shrink-0" /> Trade Republic + MyInversor
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-dashed border-emerald-300 dark:border-emerald-700/80 shadow-sm flex flex-col justify-between bg-emerald-50/25 dark:bg-emerald-950/20">
          <div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <Banknote className="h-4 w-4 text-emerald-600" />
                {t.banks.cashTitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                Informativo
              </span>
            </div>
            <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              {formatCurrency(cashBalanceCents)}
            </p>
          </div>
          <p className="text-[11px] text-surface-500 dark:text-surface-400 mt-2">
            {t.banks.cashOnlyInformative}
          </p>
        </div>
      </div>

      {/* Accounts Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
            Tus Cuentas Bancarias ({accounts.length})
          </h2>
          <span className="text-xs text-surface-500">
            💡 Haz clic en el saldo de cualquier banco para actualizarlo con lo que ves en tu móvil.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map((acc) => {
            const isCash = acc.is_cash || acc.exclude_from_calculations || acc.purpose === 'cash' || acc.name.trim().toLowerCase() === 'efectivo';
            const badge = getPurposeBadge(acc.purpose, isCash);
            const isEditing = inlineEditingId === acc.id;

            return (
              <div
                key={acc.id}
                className={`bg-white dark:bg-surface-900 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between ${
                  isCash
                    ? 'border-dashed border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/15 dark:bg-emerald-950/10'
                    : 'border-surface-200 dark:border-surface-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5">
                      <BankLogo bankName={acc.name} isCash={isCash} size="md" />
                      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 truncate">
                        {acc.name}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>

                  {acc.interest_rate && (
                    <div className="inline-block text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded mb-2">
                      {acc.interest_rate}
                    </div>
                  )}

                  {/* Balance box */}
                  <div className="my-3 p-2.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200/60 dark:border-surface-700/60">
                    <span className="text-[10px] text-surface-500 uppercase tracking-wide font-medium block mb-0.5">
                      {isCash ? 'Efectivo en mano (no computa)' : 'Saldo disponible real'}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <Input
                          value={inlineAmount}
                          onChange={(e) => setInlineAmount(e.target.value)}
                          suffix="€"
                          autoFocus
                          className="h-8 text-xs"
                        />
                        <Button size="sm" onClick={() => handleSaveInlineBalance(acc)}>
                          OK
                        </Button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setInlineEditingId(acc.id);
                          setInlineAmount(centsToEuros(acc.balance).toString().replace('.', ','));
                        }}
                        className="flex items-baseline justify-between cursor-pointer group"
                        title="Clic para editar saldo real"
                      >
                        <span className="text-xl font-bold font-mono text-surface-900 dark:text-surface-100 tabular-nums">
                          {formatCurrency(acc.balance)}
                        </span>
                        <Edit2 className="h-3 w-3 text-surface-400 group-hover:text-emerald-600 transition-colors" />
                      </div>
                    )}
                  </div>

                  {acc.notes && <p className="text-xs text-surface-500 line-clamp-2 mb-3">{acc.notes}</p>}
                </div>

                <div className="pt-2 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-[11px] text-surface-400">
                  <span>
                    {acc.last_reconciled_at
                      ? `Cuadrado: ${new Date(acc.last_reconciled_at).toLocaleDateString()}`
                      : 'Sin recuento'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditAccount(acc)}
                      className="p-1 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
                      title="Editar cuenta"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1 rounded text-danger-400 hover:text-danger-600"
                      title="Eliminar cuenta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar of Scheduled debits & Minimum balance alerts */}
      <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-600" />
              {t.banks.calendarAlerts}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Avisos automáticos de saldo mínimo requerido para no quedarte en descubierto ante recibos importantes (ej. Seguro moto).
            </p>
          </div>

          <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setShowDebitModal(true)}>
            + Añadir vencimiento
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {debits.map((deb) => {
            const bankAcc = accounts.find((a) => a.id === deb.bank_id);
            const bankBalance = bankAcc?.balance || 0;
            const isSufficient = bankBalance >= deb.amount;
            const diff = bankBalance - deb.amount;

            return (
              <div
                key={deb.id}
                className={`p-4 rounded-xl border transition-all ${
                  isSufficient
                    ? 'border-surface-200 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-800/30'
                    : 'border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-300">
                      Día {deb.due_day} de cada mes / año
                    </span>
                    <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 mt-1">{deb.title}</h3>
                    <p className="text-xs text-surface-500 font-mono flex items-center gap-1.5 mt-1">
                      <span>Cargo en:</span>
                      {bankAcc && <BankLogo bankName={bankAcc.name} isCash={bankAcc.is_cash} size="sm" className="!w-4 !h-4 !rounded" />}
                      <strong className="text-surface-800 dark:text-surface-200">{bankAcc?.name || 'Banco'}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-danger-600 dark:text-danger-400 tabular-nums">
                      -{formatCurrency(deb.amount)}
                    </span>
                    <div className="mt-1">
                      <button
                        onClick={() => handleDeleteDebit(deb.id)}
                        className="text-xs text-surface-400 hover:text-danger-600"
                        title="Eliminar aviso"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Alert */}
                <div className="mt-3 pt-2.5 border-t border-surface-200/60 dark:border-surface-700/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {isSufficient ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                          Saldo suficiente (Margen: +{formatCurrency(diff)})
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse" />
                        <span className="text-red-700 dark:text-red-300 font-bold">
                          ⚠️ Faltan {formatCurrency(Math.abs(diff))} en {bankAcc?.name} antes del día {deb.due_day}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Modal */}
      <Modal
        open={showAccountModal}
        onOpenChange={setShowAccountModal}
        title={editingAccount ? 'Editar Cuenta Bancaria' : 'Añadir Nueva Cuenta Bancaria'}
        description="Registra la cuenta para asociar gastos y controlar tu saldo disponible real."
        size="md"
      >
        <form onSubmit={handleSaveAccount} className="space-y-4">
          <Input
            label="Nombre del Banco o Entidad"
            placeholder="Ej: Banc Sabadell, Revolut, Trade Republic..."
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Saldo actual disponible (€)"
              placeholder="0,00"
              suffix="€"
              value={accountBalance}
              onChange={(e) => setAccountBalance(e.target.value)}
              required
            />
            <Select
              label="Propósito principal"
              value={accountPurpose}
              onChange={(e) => setAccountPurpose(e.target.value as BankAccountPurpose)}
              options={[
                { value: 'fixed', label: 'Gastos Fijos (40%)' },
                { value: 'leisure', label: 'Ocio y Variables (30%)' },
                { value: 'savings', label: 'Ahorro e Inversión (30%)' },
                { value: 'mixed', label: 'Cuenta Mixta' },
                { value: 'cash', label: `💵 ${t.banks.purposeCash}` },
              ]}
            />
          </div>

          <Input
            label="Condiciones / Interés (Opcional)"
            placeholder="Ej: 2% TAE, Fondos Indexados, Cuenta Nómina..."
            value={accountInterest}
            onChange={(e) => setAccountInterest(e.target.value)}
          />

          <Input
            label="Notas"
            placeholder="Ej: Tarjeta de débito para compras habituales..."
            value={accountNotes}
            onChange={(e) => setAccountNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
            <Button variant="ghost" type="button" onClick={() => setShowAccountModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar Cuenta</Button>
          </div>
        </form>
      </Modal>

      {/* Scheduled Debit Modal */}
      <Modal
        open={showDebitModal}
        onOpenChange={setShowDebitModal}
        title="Programar Vencimiento / Aviso de Saldo Mínimo"
        description="Te avisará con antelación para que la cuenta tenga el dinero mínimo necesario."
        size="md"
      >
        <form onSubmit={handleSaveDebit} className="space-y-4">
          <Input
            label="Concepto del cobro"
            placeholder="Ej: Seguro moto, Impuesto de circulación, Cuota Gimnasio..."
            value={debitTitle}
            onChange={(e) => setDebitTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Importe del recibo (€)"
              placeholder="0,00"
              suffix="€"
              value={debitAmount}
              onChange={(e) => setDebitAmount(e.target.value)}
              required
            />
            <Select
              label="Cuenta de cargo"
              value={debitBankId}
              onChange={(e) => setDebitBankId(e.target.value)}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Día del mes de cobro (1 - 31)"
              type="number"
              min={1}
              max={31}
              value={debitDay.toString()}
              onChange={(e) => setDebitDay(parseInt(e.target.value) || 1)}
              required
            />
            <Select
              label="Frecuencia"
              value={debitRecurrence}
              onChange={(e) => setDebitRecurrence(e.target.value as any)}
              options={[
                { value: 'annual', label: 'Anual (una vez al año)' },
                { value: 'monthly', label: 'Mensual' },
                { value: 'one_time', label: 'Puntual' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
            <Button variant="ghost" type="button" onClick={() => setShowDebitModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">Programar Aviso</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
