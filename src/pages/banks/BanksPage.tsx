import { useState, useEffect, useMemo, useCallback } from 'react';
import {
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
  Droplets,
  Mail,
  Send,
  Bell,
  Loader2,
  ExternalLink,
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
  calculateBankLiquidity,
  getEmailAlertSettings,
  saveEmailAlertSettings,
  type CalendarEmailAlertSettings,
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

  // Bank purpose / notes inline edit
  const [editingNotesAccId, setEditingNotesAccId] = useState<string | null>(null);
  const [inlineNote, setInlineNote] = useState('');

  // Email alert settings for calendar debits
  const [emailAlerts, setEmailAlerts] = useState<CalendarEmailAlertSettings>({
    enabled: true,
    email: user?.email || '',
    daysAdvance: 3,
  });

  const loadData = useCallback(() => {
    if (!user) return;
    const b = getBankAccounts(user.id);
    const d = getScheduledDebits(user.id);
    const em = getEmailAlertSettings(user.id, user.email || '');
    setAccounts(b);
    setDebits(d);
    setEmailAlerts(em);
    if (b.length > 0 && !debitBankId) {
      setDebitBankId(b[0].id);
    }
  }, [user, debitBankId]);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('bank-accounts-updated', handleUpdate);
    return () => window.removeEventListener('bank-accounts-updated', handleUpdate);
  }, [loadData]);

  // Comprehensive liquidity calculation:
  // "añade en bancos la liquidez, que sera todo el dinero, menos, inversiones y cuenta de emergencia"
  const liquidity = useMemo(() => {
    return calculateBankLiquidity(accounts);
  }, [accounts]);

  // Total balance in bank accounts (Excludes cash: "que ese no contara para nada, solo para tenerlo presente")
  const totalBalanceCents = useMemo(() => {
    return liquidity.totalWealthCents;
  }, [liquidity]);

  // Cash balance specifically for tracking physical money without counting in bank totals
  const cashBalanceCents = useMemo(() => {
    return accounts
      .filter((acc) => acc.is_cash || acc.exclude_from_calculations || acc.purpose === 'cash' || acc.name.trim().toLowerCase() === 'efectivo')
      .reduce((sum, acc) => sum + (acc.balance || 0), 0);
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

  const handleSaveInlineNote = (acc: BankAccount) => {
    if (!user) return;
    const updated = accounts.map((a) =>
      a.id === acc.id
        ? {
            ...a,
            notes: inlineNote.trim() || null,
            updated_at: new Date().toISOString(),
          }
        : a
    );
    saveBankAccounts(user.id, updated);
    setAccounts(updated);
    setEditingNotesAccId(null);
    success('Finalidad del banco guardada');
  };

  const handleUpdateEmailAlerts = (patch: Partial<CalendarEmailAlertSettings>) => {
    if (!user) return;
    const updated = { ...emailAlerts, ...patch };
    setEmailAlerts(updated);
    saveEmailAlertSettings(user.id, updated);
    if ('enabled' in patch) {
      if (patch.enabled) {
        success('Avisos por correo activados');
      } else {
        success('Avisos por correo desactivados');
      }
    }
  };

  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const handleSendTestAlert = async (mode: 'direct' | 'client' = 'direct') => {
    const destEmail = emailAlerts.email.trim();
    if (!destEmail || !destEmail.includes('@')) {
      showError('Introduce un correo electrónico válido');
      return;
    }
    const sample = debits[0] || { title: 'Seguro moto', amount: 5000, due_day: 15 };
    const bAcc = accounts.find((a) => a.id === sample.bank_id) || accounts[0];
    const amountStr = formatCurrency(sample.amount);
    const bankName = bAcc?.name || 'Banc Sabadell';
    const balanceStr = formatCurrency(bAcc?.balance || 0);

    const subject = `🔔 [Personal Treasury] Aviso de Vencimiento: ${sample.title} (${amountStr})`;
    const body = `Hola!

Este es un aviso automático de tu sistema Personal Treasury:

• Recibo / Cobro: ${sample.title}
• Importe previsto: ${amountStr}
• Cuenta de cargo: ${bankName}
• Saldo actual en cuenta: ${balanceStr}
• Día previsto de cobro: Día ${sample.due_day}
• Antelación configurada: ${emailAlerts.daysAdvance} días antes

Tu cuenta dispone de saldo suficiente para atender el cargo sin descubiertos.

--
Personal Treasury · 2026`;

    if (mode === 'client') {
      window.open(`mailto:${encodeURIComponent(destEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      success(`Abierto en tu gestor de correo`, `Comprueba el borrador para enviar a ${destEmail}`);
      return;
    }

    setSendingTestEmail(true);

    try {
      // Direct email dispatch using FormSubmit API
      const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(destEmail)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          _subject: subject,
          Aplicación: 'Personal Treasury',
          Aviso: `Vencimiento de recibo previsto: ${sample.title}`,
          Importe: amountStr,
          Banco_de_cargo: bankName,
          Saldo_Disponible: balanceStr,
          Día_de_cobro: `Día ${sample.due_day}`,
          Antelación_aviso: `${emailAlerts.daysAdvance} días`,
          Mensaje: body,
          _template: 'box',
        }),
      });

      if (res.ok) {
        success(
          `¡Correo de prueba enviado con éxito a ${destEmail}!`,
          `Revisa tu bandeja de entrada o carpeta de spam si es la primera vez que recibes un aviso.`
        );
      } else {
        // Fallback to mail client
        window.open(`mailto:${encodeURIComponent(destEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
        success(`Aviso preparado en tu cliente de correo para ${destEmail}`);
      }
    } catch {
      window.open(`mailto:${encodeURIComponent(destEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      success(`Aviso preparado en tu gestor de correo para ${destEmail}`);
    } finally {
      setSendingTestEmail(false);
    }
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

      {/* Global wealth & Liquidity banner */}
      <div className="space-y-4">
        {/* Main Liquidity Hero Card */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-600 via-teal-600 to-emerald-600 p-6 text-white shadow-lg">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
            <Droplets className="w-48 h-48" />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm text-white">
                  <Droplets className="w-3.5 h-3.5 text-cyan-200" />
                  Liquidez Total Disponible
                </span>
                <span className="text-xs text-teal-100 bg-teal-900/40 px-2 py-0.5 rounded-full font-medium">
                  Sabadell + Revolut
                </span>
              </div>
              <p className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums mt-2 tracking-tight drop-shadow-sm">
                {formatCurrency(liquidity.liquidityCents)}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-emerald-100">
                <span className="font-semibold text-white">Fórmula de liquidez:</span>
                <span className="px-2 py-0.5 rounded bg-black/20 font-mono">
                  Total ({formatCurrency(liquidity.totalWealthCents)}) − Inversiones ({formatCurrency(liquidity.investmentsCents)}) − Emergencia ({formatCurrency(liquidity.emergencyFundCents)})
                </span>
              </div>
            </div>

            {/* Sub-breakdown of liquidity */}
            <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0">
              <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-w-[200px]">
                <span className="text-xs text-sky-100 font-medium">Banc Sabadell (Fijos):</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(liquidity.sabadellCents)}</span>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 min-w-[200px]">
                <span className="text-xs text-teal-100 font-medium">Revolut (Ocio):</span>
                <span className="text-sm font-bold font-mono">{formatCurrency(liquidity.revolutCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global summary 4-cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-500">
                Total en Cuentas
              </span>
              <p className="text-2xl font-extrabold font-mono tabular-nums mt-1 text-surface-900 dark:text-surface-100">
                {formatCurrency(totalBalanceCents)}
              </p>
            </div>
            <p className="text-xs text-surface-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Suma total de bancos</span>
            </p>
          </div>

          <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-surface-500 font-semibold uppercase tracking-wider">
                  Cuenta Emergencia
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                  Intocable
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {formatCurrency(liquidity.emergencyFundCents)}
              </p>
            </div>
            <span className="text-[11px] text-surface-400 mt-2 flex items-center gap-1">
              <span>Trade Republic · 2% TAE</span>
            </span>
          </div>

          <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-surface-500 font-semibold uppercase tracking-wider">
                  Inversiones L/P
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                  Patrimonio
                </span>
              </div>
              <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1 tabular-nums">
                {formatCurrency(liquidity.investmentsCents)}
              </p>
            </div>
            <p className="text-xs text-surface-500 mt-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-purple-500 shrink-0" /> MyInvestor Carteras / Fondos
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
      </div>

      {/* Accounts Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-surface-700 dark:text-surface-300">
            Tus Cuentas Bancarias ({accounts.length})
          </h2>
          <span className="text-xs text-surface-500">
            💡 Haz clic en el saldo o finalidad de cualquier banco para ajustarlo a tu medida.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map((acc) => {
            const isCash = acc.is_cash || acc.exclude_from_calculations || acc.purpose === 'cash' || acc.name.trim().toLowerCase() === 'efectivo';
            const badge = getPurposeBadge(acc.purpose, isCash);
            const isEditingBalance = inlineEditingId === acc.id;
            const isEditingNote = editingNotesAccId === acc.id;
            const isLiquidity = acc.id === 'b-sabadell' || acc.id === 'b-revolut';
            const isEmergency = acc.id === 'b-trade-republic' || acc.name.toLowerCase().includes('trade republic');
            const isInvestment = acc.id === 'b-myinvestor' || acc.id === 'b-myinversor' || acc.name.toLowerCase().includes('myinvestor');

            return (
              <div
                key={acc.id}
                className={`bg-white dark:bg-surface-900 border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between ${
                  isCash
                    ? 'border-dashed border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/15 dark:bg-emerald-950/10'
                    : isLiquidity
                    ? 'border-sky-200 dark:border-sky-900/60'
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

                  {/* Liquidity computation status */}
                  <div className="mb-2">
                    {isLiquidity && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-200/60 dark:border-sky-800/60">
                        <Droplets className="w-3 h-3 text-sky-500" /> Computa en Liquidez
                      </span>
                    )}
                    {isEmergency && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-800/60">
                        🛡️ Cuenta Emergencia (Excluido)
                      </span>
                    )}
                    {isInvestment && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded-md border border-purple-200/60 dark:border-purple-800/60">
                        📈 Inversión (Excluido de Liquidez)
                      </span>
                    )}
                    {isCash && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                        💵 Físico (Solo Informativo)
                      </span>
                    )}
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

                    {isEditingBalance ? (
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

                  {/* Purpose & Role: Fully user defined */}
                  <div className="mt-2 mb-3 p-2.5 rounded-xl bg-surface-50/80 dark:bg-surface-800/70 border border-surface-200/70 dark:border-surface-700/70">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400">
                        📌 Finalidad / Uso:
                      </span>
                      {!isEditingNote && (
                        <button
                          onClick={() => {
                            setEditingNotesAccId(acc.id);
                            setInlineNote(acc.notes || '');
                          }}
                          className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5 font-medium"
                          title="Editar finalidad del banco"
                        >
                          <Edit2 className="w-2.5 h-2.5" /> Editar
                        </button>
                      )}
                    </div>

                    {isEditingNote ? (
                      <div className="space-y-1.5 mt-1">
                        <textarea
                          value={inlineNote}
                          onChange={(e) => setInlineNote(e.target.value)}
                          rows={2}
                          placeholder="Para qué utilizas este banco..."
                          className="w-full text-xs p-1.5 rounded-lg border border-brand-400 dark:border-brand-600 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none"
                          autoFocus
                        />
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => setEditingNotesAccId(null)}
                            className="px-2 py-0.5 rounded text-[11px] text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveInlineNote(acc)}
                            className="px-2.5 py-0.5 rounded text-[11px] bg-brand-600 hover:bg-brand-500 text-white font-medium"
                          >
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-surface-700 dark:text-surface-200 leading-snug">
                        {acc.notes ? (
                          <span>{acc.notes}</span>
                        ) : (
                          <span className="text-surface-400 italic">Sin especificar. Pulsa editar para definir para qué tienes esta cuenta.</span>
                        )}
                      </p>
                    )}
                  </div>
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

      {/* Calendar of Scheduled debits & Email alert notifications */}
      <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-surface-900 dark:text-surface-100 flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-600" />
              {t.banks.calendarAlerts}
            </h2>
            <p className="text-xs text-surface-500 mt-0.5">
              Control de vencimientos con avisos por correo para asegurar que dispones del saldo mínimo en cada banco antes del cargo.
            </p>
          </div>

          <Button size="sm" variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => setShowDebitModal(true)}>
            + Añadir vencimiento
          </Button>
        </div>

        {/* Email Alerts configuration card */}
        <div className="bg-gradient-to-br from-brand-50/70 to-indigo-50/70 dark:from-surface-950 dark:to-surface-900 rounded-2xl border border-brand-200/80 dark:border-brand-900/60 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-brand-600 text-white shrink-0 shadow-sm">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                    Avisos por Correo Electrónico ante Vencimientos
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300">
                    {emailAlerts.enabled ? 'Activo' : 'Pausado'}
                  </span>
                </div>
                <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
                  El sistema te avisa por correo electrónico {emailAlerts.daysAdvance} días antes del vencimiento para evitar descubiertos.
                </p>
              </div>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center gap-2 shrink-0">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts.enabled}
                  onChange={(e) => handleUpdateEmailAlerts({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-200 peer-focus:outline-none rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-brand-600"></div>
              </label>
              <span className="text-xs font-semibold text-surface-700 dark:text-surface-300">
                {emailAlerts.enabled ? 'Activado' : 'Desactivado'}
              </span>
            </div>
          </div>

          {emailAlerts.enabled && (
            <div className="pt-3 border-t border-brand-200/50 dark:border-surface-800 flex flex-col md:flex-row items-stretch md:items-end gap-3">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-surface-600 dark:text-surface-400 block mb-1">
                  Dirección de correo para los avisos:
                </label>
                <Input
                  type="email"
                  value={emailAlerts.email}
                  onChange={(e) => handleUpdateEmailAlerts({ email: e.target.value })}
                  placeholder="tu-correo@ejemplo.com"
                  className="h-8 text-xs bg-white dark:bg-surface-900"
                />
              </div>

              <div className="w-full md:w-56">
                <label className="text-[11px] font-semibold text-surface-600 dark:text-surface-400 block mb-1">
                  Antelación de aviso:
                </label>
                <select
                  value={emailAlerts.daysAdvance}
                  onChange={(e) => handleUpdateEmailAlerts({ daysAdvance: parseInt(e.target.value) || 3 })}
                  className="w-full h-8 text-xs px-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value={1}>1 día antes del vencimiento</option>
                  <option value={3}>3 días antes del vencimiento (Recomendado)</option>
                  <option value={5}>5 días antes del vencimiento</option>
                  <option value={7}>7 días antes del vencimiento (1 semana)</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleSendTestAlert('direct')}
                  disabled={sendingTestEmail}
                  className="h-8 text-xs font-medium"
                  icon={
                    sendingTestEmail ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )
                  }
                >
                  {sendingTestEmail ? 'Enviando email...' : 'Enviar correo de prueba'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendTestAlert('client')}
                  className="h-8 text-xs font-medium"
                  title="Abrir borrador en tu cliente de correo (Gmail, Outlook...)"
                  icon={<ExternalLink className="w-3.5 h-3.5" />}
                >
                  Abrir en mi correo
                </Button>
              </div>
            </div>
          )}
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

                {/* Status Alert & Email Badge */}
                <div className="mt-3 pt-2.5 border-t border-surface-200/60 dark:border-surface-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    {isSufficient ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                          Saldo suficiente (Margen: +{formatCurrency(diff)})
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4 text-red-600 animate-pulse shrink-0" />
                        <span className="text-red-700 dark:text-red-300 font-bold">
                          ⚠️ Faltan {formatCurrency(Math.abs(diff))} en {bankAcc?.name} antes del día {deb.due_day}
                        </span>
                      </>
                    )}
                  </div>

                  {emailAlerts.enabled && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-surface-500 font-medium bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded-full shrink-0">
                      <Bell className="w-3 h-3 text-brand-600" /> Aviso email: {emailAlerts.daysAdvance} días antes
                    </span>
                  )}
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
            placeholder="Ej: Banc Sabadell, Revolut, Trade Republic, MyInvestor..."
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
                { value: 'fixed', label: 'Gastos Fijos y Nómina (Computa en Liquidez)' },
                { value: 'leisure', label: 'Ocio y Gastos Variables (Computa en Liquidez)' },
                { value: 'savings', label: 'Cuenta Emergencia / Inversiones (Excluido)' },
                { value: 'mixed', label: 'Cuenta Mixta' },
                { value: 'cash', label: `💵 Efectivo Físico (No computa en liquidez)` },
              ]}
            />
          </div>

          <Input
            label="Condiciones / Interés (Opcional)"
            placeholder="Ej: 2% TAE, Fondos Indexados, Cuenta Nómina..."
            value={accountInterest}
            onChange={(e) => setAccountInterest(e.target.value)}
          />

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              ¿Para qué utilizas este banco? (Finalidad y uso personalizado)
            </label>
            <textarea
              className="w-full text-xs p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              rows={2}
              placeholder="Ej: Donde entra la nómina y de donde se cobra el gym y todo lo fijo."
              value={accountNotes}
              onChange={(e) => setAccountNotes(e.target.value)}
            />
          </div>

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
