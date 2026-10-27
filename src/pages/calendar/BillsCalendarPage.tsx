import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Send,
  Clock,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ShieldCheck,
  Edit2,
  Trash2,
  Loader2,
  ExternalLink,
  CalendarDays,
  List,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button, Input, Select, Modal } from '@/components/ui';
import { formatCurrency, eurosToCents } from '@/lib/money';
import {
  getBankAccounts,
  getScheduledDebits,
  saveScheduledDebits,
  getEmailAlertSettings,
  saveEmailAlertSettings,
  type CalendarEmailAlertSettings,
} from '@/lib/banks';
import { BankLogo } from '@/components/banks/BankLogo';
import type { BankAccount, BankScheduledDebit } from '@/types';

export function BillsCalendarPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { language } = useLanguage();

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [debits, setDebits] = useState<BankScheduledDebit[]>([]);
  const [emailAlerts, setEmailAlerts] = useState<CalendarEmailAlertSettings>({
    enabled: true,
    email: '',
    daysAdvance: 3,
  });
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Selected date for the calendar view (Year & Month)
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1); // 1 - 12
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | 'monthly' | 'annual' | 'one_time'>('all');

  // Modal State for Add/Edit Debit
  const [showDebitModal, setShowDebitModal] = useState(false);
  const [debitIdToEdit, setDebitIdToEdit] = useState<string | null>(null);
  const [debitTitle, setDebitTitle] = useState('');
  const [debitAmount, setDebitAmount] = useState('');
  const [debitBankId, setDebitBankId] = useState('');
  const [debitDay, setDebitDay] = useState(1);
  const [debitRecurrence, setDebitRecurrence] = useState<'annual' | 'monthly' | 'one_time'>('monthly');
  const [debitNotes, setDebitNotes] = useState('');

  // 1. Load Data
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

  // Open Add Modal
  const handleOpenAddModal = (dayPreset?: number) => {
    setDebitIdToEdit(null);
    setDebitTitle('');
    setDebitAmount('');
    setDebitDay(dayPreset || Math.min(today.getDate(), 28));
    setDebitRecurrence('monthly');
    setDebitNotes('');
    if (accounts.length > 0) {
      setDebitBankId(accounts[0].id);
    }
    setShowDebitModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (deb: BankScheduledDebit) => {
    setDebitIdToEdit(deb.id);
    setDebitTitle(deb.title);
    setDebitAmount((deb.amount / 100).toFixed(2).replace('.', ','));
    setDebitBankId(deb.bank_id);
    setDebitDay(deb.due_day);
    setDebitRecurrence(deb.recurrence);
    setDebitNotes(deb.notes || '');
    setShowDebitModal(true);
  };

  // Save Debit (Add or Edit)
  const handleSaveDebit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const trimmedTitle = debitTitle.trim();
    if (!trimmedTitle) {
      showError(language === 'ca' ? 'Introdueix el concepte del rebut' : 'Introduce el concepto del recibo');
      return;
    }

    const parsed = parseFloat(debitAmount.replace(',', '.'));
    const cents = isNaN(parsed) || parsed <= 0 ? 0 : eurosToCents(parsed);
    if (cents <= 0) {
      showError(language === 'ca' ? 'Introdueix un import vàlid' : 'Introduce un importe válido');
      return;
    }

    let updated: BankScheduledDebit[];
    if (debitIdToEdit) {
      updated = debits.map((d) =>
        d.id === debitIdToEdit
          ? {
              ...d,
              title: trimmedTitle,
              amount: cents,
              bank_id: debitBankId,
              due_day: debitDay,
              recurrence: debitRecurrence,
              notes: debitNotes.trim() || undefined,
            }
          : d
      );
      success(
        language === 'ca' ? 'Rebut actualitzat' : 'Recibo actualizado',
        trimmedTitle
      );
    } else {
      const newDebit: BankScheduledDebit = {
        id: 'deb_' + Date.now(),
        bank_id: debitBankId,
        title: trimmedTitle,
        amount: cents,
        due_day: debitDay,
        recurrence: debitRecurrence,
        notes: debitNotes.trim() || undefined,
      };
      updated = [...debits, newDebit];
      success(
        language === 'ca' ? 'Nou venciment programat' : 'Nuevo vencimiento programado',
        trimmedTitle
      );
    }

    setDebits(updated);
    saveScheduledDebits(user.id, updated);
    setShowDebitModal(false);
  };

  // Delete Debit
  const handleDeleteDebit = (id: string) => {
    if (!user) return;
    const deb = debits.find((d) => d.id === id);
    if (
      !confirm(
        language === 'ca'
          ? `Segur que vols eliminar l'avís de "${deb?.title || 'rebut'}"?`
          : `¿Seguro que quieres eliminar el aviso de "${deb?.title || 'recibo'}"?`
      )
    ) {
      return;
    }
    const updated = debits.filter((d) => d.id !== id);
    setDebits(updated);
    saveScheduledDebits(user.id, updated);
    success(language === 'ca' ? 'Avís eliminat' : 'Aviso de cobro eliminado');
  };

  // Email alert settings updates
  const handleUpdateEmailAlerts = (patch: Partial<CalendarEmailAlertSettings>) => {
    if (!user) return;
    const updated = { ...emailAlerts, ...patch };
    setEmailAlerts(updated);
    saveEmailAlertSettings(user.id, updated);
    success(language === 'ca' ? 'Configuració desada' : 'Avisos actualizados');
  };

  // Test Email Alert
  const handleSendTestAlert = async (type: 'direct' | 'client' = 'direct') => {
    if (!emailAlerts.email || !emailAlerts.email.includes('@')) {
      showError(language === 'ca' ? 'Introdueix un correu vàlid' : 'Introduce un correo electrónico válido');
      return;
    }

    const recipient = emailAlerts.email.trim();
    const upcomingList = debits
      .map((d) => {
        const b = accounts.find((a) => a.id === d.bank_id);
        return `• ${d.title}: ${(d.amount / 100).toFixed(2)} € (Día ${d.due_day} en ${b?.name || 'Banco'})`;
      })
      .join('\n');

    const subject = encodeURIComponent(`[Aviso Vencimiento] Recordatorio de recibos próximos - Personal Treasury`);
    const body = encodeURIComponent(
      `Hola,\n\nEste es un recordatorio de prueba de tus vencimientos domiciliados con ${emailAlerts.daysAdvance} días de antelación:\n\n${upcomingList || '• Sin recibos programados'}\n\nAsegúrate de tener saldo suficiente en cada cuenta para evitar descubiertos.\n\nAtentamente,\nPersonal Treasury`
    );

    if (type === 'client') {
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
      success(language === 'ca' ? 'Borrador obert al teu correu' : 'Borrador abierto en tu cliente de correo');
      return;
    }

    setSendingTestEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: 'Aviso de Vencimiento de Recibos - Personal Treasury',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #0f172a; margin-top: 0;">📅 Recordatorio de Vencimientos</h2>
              <p style="color: #475569; font-size: 14px;">El sistema te avisa <strong>${emailAlerts.daysAdvance} días antes</strong> para garantizar que tus cuentas dispongan de liquidez:</p>
              <div style="background: #f8fafc; border-radius: 8px; padding: 14px; margin: 16px 0; border: 1px solid #e2e8f0;">
                ${debits
                  .map((d) => {
                    const b = accounts.find((a) => a.id === d.bank_id);
                    return `<div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #edf2f7; font-size: 13px;">
                      <span><strong>Día ${d.due_day}:</strong> ${d.title} (${b?.name || 'Banco'})</span>
                      <span style="font-weight: bold; color: #dc2626;">-${(d.amount / 100).toFixed(2)} €</span>
                    </div>`;
                  })
                  .join('') || '<p style="color:#64748b;font-size:13px;margin:0;">No tienes recibos programados actualmente.</p>'}
              </div>
              <p style="color: #64748b; font-size: 12px; margin-bottom: 0;">Este es un correo automático enviado desde Personal Treasury.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
        success('Abriendo borrador en tu correo...', 'No hay servidor SMTP activo');
      } else {
        success('Correo enviado con éxito', `Enviado a ${recipient}`);
      }
    } catch {
      window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, '_blank');
      success('Abriendo en tu correo', 'Cliente abierto');
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Filtered debits
  const filteredDebits = useMemo(() => {
    return debits.filter((d) => {
      if (frequencyFilter === 'all') return true;
      return d.recurrence === frequencyFilter;
    });
  }, [debits, frequencyFilter]);

  // Total expenses in the selected month
  const totalMonthDebitsCents = useMemo(() => {
    return debits.reduce((sum, d) => sum + d.amount, 0);
  }, [debits]);

  // Upcoming debits calculation (< 7 days or due soon this month)
  const currentDay = today.getDate();
  const isCurrentMonthView = selectedYear === today.getFullYear() && selectedMonth === today.getMonth() + 1;

  const upcomingDebits = useMemo(() => {
    return debits
      .map((d) => {
        let daysUntil = d.due_day - currentDay;
        if (daysUntil < 0) {
          daysUntil += 30;
        }
        return {
          ...d,
          daysUntil,
          isUrgent: daysUntil >= 0 && daysUntil <= 7,
          isToday: daysUntil === 0,
        };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [debits, currentDay]);

  const urgentDebits = useMemo(() => {
    return upcomingDebits.filter((d) => d.daysUntil <= 7);
  }, [upcomingDebits]);

  // Calculate calendar days grid for selectedMonth/selectedYear
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const days: Array<{
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      debits: BankScheduledDebit[];
    }> = [];

    // Previous month filler days
    const prevMonthDays = new Date(selectedYear, selectedMonth - 1, 0).getDate();
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      days.push({
        dayNumber: prevMonthDays - i,
        isCurrentMonth: false,
        isToday: false,
        debits: [],
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday =
        selectedYear === today.getFullYear() &&
        selectedMonth === today.getMonth() + 1 &&
        i === today.getDate();

      const dayDebits = debits.filter((d) => d.due_day === i);

      days.push({
        dayNumber: i,
        isCurrentMonth: true,
        isToday,
        debits: dayDebits,
      });
    }

    // Next month filler days to complete rows (multiples of 7)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          dayNumber: i,
          isCurrentMonth: false,
          isToday: false,
          debits: [],
        });
      }
    }

    return days;
  }, [selectedYear, selectedMonth, debits, today]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth() + 1);
  };

  const monthNamesEs = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const monthNamesCa = [
    'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny',
    'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre',
  ];
  const monthName = language === 'ca' ? monthNamesCa[selectedMonth - 1] : monthNamesEs[selectedMonth - 1];

  const weekDaysEs = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weekDaysCa = ['Dll', 'Dmt', 'Dmc', 'Djs', 'Dvd', 'Dss', 'Dmg'];
  const weekDays = language === 'ca' ? weekDaysCa : weekDaysEs;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 select-text">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 shadow-sm border border-purple-200 dark:border-purple-800">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
                {language === 'ca' ? 'Calendari de Rebuts i Venciments' : 'Calendario de Recibos y Vencimientos'}
              </h1>
              <p className="text-xs sm:text-sm text-surface-500 mt-0.5">
                {language === 'ca'
                  ? 'Planificació de rebuts domiciliats, alertes de saldo mínim i recordatoris per correu.'
                  : 'Planificación de recibos domiciliados, alertas de saldo mínimo y recordatorios por correo.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-surface-100 dark:bg-surface-800 p-0.5 rounded-xl border border-surface-200 dark:border-surface-700">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-surface-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-surface-500 hover:text-surface-900 dark:hover:text-surface-200'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{language === 'ca' ? 'Calendari' : 'Calendario'}</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-surface-700 text-purple-700 dark:text-purple-300 shadow-sm'
                  : 'text-surface-500 hover:text-surface-900 dark:hover:text-surface-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>{language === 'ca' ? 'Llistat' : 'Listado'}</span>
            </button>
          </div>

          <Button
            onClick={() => handleOpenAddModal()}
            className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            icon={<Plus className="h-4 w-4" />}
          >
            {language === 'ca' ? 'Nou Venciment' : 'Nuevo Vencimiento'}
          </Button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Mes */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl p-4 border border-surface-200 dark:border-surface-800 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-surface-500 text-xs font-medium">
            <span>{language === 'ca' ? 'Càrrecs aquest mes' : 'Cargos este mes'}</span>
            <DollarSign className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-surface-900 dark:text-surface-100 tabular-nums">
            {formatCurrency(totalMonthDebitsCents)}
          </div>
          <p className="text-[11px] text-surface-400 font-medium">
            {debits.length} {language === 'ca' ? 'rebuts programats' : 'recibos programados'}
          </p>
        </div>

        {/* Card 2: Próximos Vencimientos */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl p-4 border border-surface-200 dark:border-surface-800 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-surface-500 text-xs font-medium">
            <span>{language === 'ca' ? 'Vencen en ≤ 7 dies' : 'Vencen en ≤ 7 días'}</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {urgentDebits.length}
            </span>
            <span className="text-xs font-semibold text-surface-400">
              ({formatCurrency(urgentDebits.reduce((s, d) => s + d.amount, 0))})
            </span>
          </div>
          <p className="text-[11px] text-surface-400">
            {urgentDebits.length > 0
              ? language === 'ca'
                ? 'Atenció propera als càrrecs'
                : 'Atención próxima a los cobros'
              : language === 'ca'
              ? 'Cap rebut urgent a la vista'
              : 'Sin cobros urgentes a la vista'}
          </p>
        </div>

        {/* Card 3: Cobertura de Saldo */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl p-4 border border-surface-200 dark:border-surface-800 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-surface-500 text-xs font-medium">
            <span>{language === 'ca' ? 'Cobertura de Saldo' : 'Cobertura de Saldo'}</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          {(() => {
            const hasShortfall = debits.some((d) => {
              const b = accounts.find((a) => a.id === d.bank_id);
              return (b?.balance || 0) < d.amount;
            });
            return (
              <>
                <div className="flex items-center gap-1.5">
                  {hasShortfall ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      <span className="text-base font-bold text-red-600 dark:text-red-400">
                        {language === 'ca' ? 'Saldo insuficient' : 'Saldo insuficiente'}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {language === 'ca' ? 'Comptes coberts' : 'Cuentas cubiertas'}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-[11px] text-surface-400">
                  {hasShortfall
                    ? language === 'ca'
                      ? 'Revisa el compte amb descobert'
                      : 'Revisa la cuenta con descubierto'
                    : language === 'ca'
                    ? 'Tots els bancs tenen marge suficient'
                    : 'Todos los bancos tienen margen'}
                </p>
              </>
            );
          })()}
        </div>

        {/* Card 4: Avisos por Email */}
        <div className="bg-white dark:bg-surface-900 rounded-2xl p-4 border border-surface-200 dark:border-surface-800 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-surface-500 text-xs font-medium">
            <span>{language === 'ca' ? 'Avisos per Correu' : 'Avisos por Correo'}</span>
            <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                emailAlerts.enabled
                  ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700'
                  : 'bg-surface-200 text-surface-700 border-surface-300 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700'
              }`}
            >
              {emailAlerts.enabled ? '● Activo' : '○ Pausado'}
            </span>
            <span className="text-xs font-mono text-surface-500">
              {emailAlerts.daysAdvance}d {language === 'ca' ? 'abans' : 'antes'}
            </span>
          </div>
          <p className="text-[11px] text-surface-400 truncate">
            {emailAlerts.email || 'Sense correu configurat'}
          </p>
        </div>
      </div>

      {/* Urgent Spotlight Banner: "Quedan pocos días" */}
      {urgentDebits.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/40 dark:via-amber-950/20 rounded-2xl border border-amber-300/80 dark:border-amber-800/60 p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-amber-500 text-white shrink-0">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                  {language === 'ca' ? 'Pròxims Venciments (Queden pocs dies)' : 'Próximos Vencimientos (Quedan pocos días)'}
                </h2>
                <p className="text-xs text-surface-500">
                  {language === 'ca'
                    ? 'Rebuts que es carregaran els propers 7 dies. Comprova el saldo disponible al banc.'
                    : 'Recibos que se cobrarán en los próximos 7 días. Comprueba el saldo disponible en el banco.'}
                </p>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-300 dark:border-amber-700">
              {urgentDebits.length} {language === 'ca' ? 'pendents' : 'pendientes'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {urgentDebits.map((deb) => {
              const bankAcc = accounts.find((a) => a.id === deb.bank_id);
              const bankBalance = bankAcc?.balance || 0;
              const isSufficient = bankBalance >= deb.amount;
              const diff = bankBalance - deb.amount;

              return (
                <div
                  key={deb.id}
                  onClick={() => handleOpenEditModal(deb)}
                  className="bg-white dark:bg-surface-900/90 rounded-xl p-3 border border-amber-200 dark:border-amber-900/50 hover:border-amber-400 transition-all shadow-xs cursor-pointer group space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                          {deb.daysUntil === 0
                            ? language === 'ca' ? '¡Venc avui!' : '¡Vence hoy!'
                            : deb.daysUntil === 1
                            ? language === 'ca' ? 'Demà (Día ' + deb.due_day + ')' : 'Mañana (Día ' + deb.due_day + ')'
                            : `${language === 'ca' ? 'En' : 'En'} ${deb.daysUntil} ${language === 'ca' ? 'dies' : 'días'} (Día ${deb.due_day})`}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-surface-900 dark:text-surface-100 mt-1 truncate group-hover:text-amber-600 transition-colors">
                        {deb.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-surface-500 mt-0.5">
                        {bankAcc && <BankLogo bankName={bankAcc.name} isCash={bankAcc.is_cash} size="sm" className="!w-3.5 !h-3.5 !rounded" />}
                        <span className="truncate">{bankAcc?.name || 'Banco'}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-red-600 dark:text-red-400 tabular-nums">
                        -{formatCurrency(deb.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-[11px]">
                    {isSufficient ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Margen: +{formatCurrency(diff)}
                      </span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" /> Faltan {formatCurrency(Math.abs(diff))}
                      </span>
                    )}
                    <span className="text-[10px] text-surface-400">Editar →</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Section: Calendar Grid OR List View */}
      {viewMode === 'calendar' ? (
        <div className="bg-white dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm p-4 sm:p-6 space-y-4">
          {/* Month & Year Navigation Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-surface-100 dark:border-surface-800">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 transition-colors"
                title="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="px-3 py-1 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200/80 dark:border-surface-700 text-sm font-bold text-surface-900 dark:text-surface-100 min-w-[150px] text-center">
                {monthName} {selectedYear}
              </div>

              <button
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 transition-colors"
                title="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {!isCurrentMonthView && (
                <button
                  onClick={handleJumpToToday}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 transition-colors"
                >
                  {language === 'ca' ? 'Mes actual' : 'Mes actual'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-surface-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                {language === 'ca' ? 'Dia amb rebut' : 'Día con recibo'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                {language === 'ca' ? 'Alerta descobert' : 'Alerta descubierto'}
              </span>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-surface-400 py-1">
            {weekDays.map((d, i) => (
              <div key={d} className={`py-1 ${i >= 5 ? 'text-surface-400' : 'text-surface-600 dark:text-surface-300'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Month Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((cell, idx) => {
              const hasDebits = cell.debits.length > 0;
              const hasInsufficientBalance = cell.debits.some((deb) => {
                const b = accounts.find((a) => a.id === deb.bank_id);
                return (b?.balance || 0) < deb.amount;
              });

              return (
                <div
                  key={idx}
                  onClick={() => cell.isCurrentMonth && handleOpenAddModal(cell.dayNumber)}
                  className={`min-h-[85px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-xl border transition-all flex flex-col justify-between ${
                    !cell.isCurrentMonth
                      ? 'bg-surface-50/40 dark:bg-surface-900/30 border-dashed border-surface-200/60 dark:border-surface-800/40 text-surface-400 opacity-40 cursor-default'
                      : cell.isToday
                      ? 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-400 dark:border-purple-600 shadow-xs cursor-pointer hover:bg-purple-100/50'
                      : hasDebits
                      ? 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-700/80 shadow-xs cursor-pointer hover:border-purple-300 dark:hover:border-purple-700'
                      : 'bg-white dark:bg-surface-900/50 border-surface-150 dark:border-surface-800/60 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer'
                  }`}
                >
                  {/* Top Day Header */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono font-bold ${
                        cell.isToday
                          ? 'w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]'
                          : cell.isCurrentMonth
                          ? 'text-surface-800 dark:text-surface-200'
                          : 'text-surface-400'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.isToday && (
                      <span className="text-[9px] font-bold uppercase text-purple-700 dark:text-purple-300 hidden sm:inline">
                        {language === 'ca' ? 'Avui' : 'Hoy'}
                      </span>
                    )}

                    {hasInsufficientBalance && (
                      <span title="Alerta: Fondos insuficientes en la cuenta">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                      </span>
                    )}
                  </div>

                  {/* Debits for this day */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {cell.debits.slice(0, 2).map((deb) => {
                      const bankAcc = accounts.find((a) => a.id === deb.bank_id);
                      const isLow = (bankAcc?.balance || 0) < deb.amount;

                      return (
                        <div
                          key={deb.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(deb);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold border flex items-center justify-between gap-1 truncate transition-transform hover:scale-[1.02] ${
                            isLow
                              ? 'bg-red-50 dark:bg-red-950/80 text-red-900 dark:text-red-200 border-red-300 dark:border-red-800'
                              : 'bg-purple-50 dark:bg-purple-950/70 text-purple-950 dark:text-purple-200 border-purple-200 dark:border-purple-800'
                          }`}
                          title={`${deb.title} - ${(deb.amount / 100).toFixed(2)} € (${bankAcc?.name || 'Banco'})`}
                        >
                          <span className="truncate">{deb.title}</span>
                          <span className="font-mono font-bold shrink-0 tabular-nums">
                            {(deb.amount / 100).toFixed(0)}€
                          </span>
                        </div>
                      );
                    })}

                    {cell.debits.length > 2 && (
                      <div className="text-[10px] text-surface-400 font-semibold text-center">
                        +{cell.debits.length - 2} {language === 'ca' ? 'més' : 'más'}
                      </div>
                    )}
                  </div>

                  {/* Empty state bottom indicator for add button on hover */}
                  {!hasDebits && cell.isCurrentMonth && (
                    <div className="text-[10px] text-surface-300 opacity-0 hover:opacity-100 text-center font-bold">
                      +
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List Mode View */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-500 font-semibold">{language === 'ca' ? 'Filtrar per:' : 'Filtrar por:'}</span>
            <div className="flex items-center gap-1">
              {(['all', 'monthly', 'annual', 'one_time'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFrequencyFilter(mode)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    frequencyFilter === mode
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200'
                  }`}
                >
                  {mode === 'all'
                    ? language === 'ca' ? 'Tots' : 'Todos'
                    : mode === 'monthly'
                    ? language === 'ca' ? 'Mensuals' : 'Mensuales'
                    : mode === 'annual'
                    ? language === 'ca' ? 'Anuals' : 'Anuales'
                    : language === 'ca' ? 'Puntuals' : 'Puntuales'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredDebits.map((deb) => {
              const bankAcc = accounts.find((a) => a.id === deb.bank_id);
              const bankBalance = bankAcc?.balance || 0;
              const isSufficient = bankBalance >= deb.amount;
              const diff = bankBalance - deb.amount;

              return (
                <div
                  key={deb.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 ${
                    isSufficient
                      ? 'border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-sm'
                      : 'border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200/60 dark:border-surface-700">
                        {language === 'ca' ? 'Dia' : 'Día'} {deb.due_day} ·{' '}
                        {deb.recurrence === 'monthly'
                          ? language === 'ca' ? 'Mensual' : 'Mensual'
                          : deb.recurrence === 'annual'
                          ? language === 'ca' ? 'Anual' : 'Anual'
                          : language === 'ca' ? 'Puntual' : 'Puntual'}
                      </span>
                      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 mt-1.5">{deb.title}</h3>
                      <p className="text-xs text-surface-500 flex items-center gap-1.5 mt-1">
                        <span>{language === 'ca' ? 'Compte:' : 'Cuenta:'}</span>
                        {bankAcc && <BankLogo bankName={bankAcc.name} isCash={bankAcc.is_cash} size="sm" className="!w-4 !h-4 !rounded" />}
                        <strong className="text-surface-800 dark:text-surface-200">{bankAcc?.name || 'Banco'}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-bold font-mono text-danger-600 dark:text-danger-400 tabular-nums">
                        -{formatCurrency(deb.amount)}
                      </span>
                      <div className="flex items-center justify-end gap-1 mt-2">
                        <button
                          onClick={() => handleOpenEditModal(deb)}
                          className="p-1 text-surface-400 hover:text-purple-600 transition-colors"
                          title="Editar recibo"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDebit(deb.id)}
                          className="p-1 text-surface-400 hover:text-danger-600 transition-colors"
                          title="Eliminar recibo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {deb.notes && (
                    <p className="text-xs text-surface-500 italic bg-surface-50 dark:bg-surface-800/40 p-2 rounded-lg border border-surface-100 dark:border-surface-800">
                      {deb.notes}
                    </p>
                  )}

                  <div className="pt-2.5 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between text-xs">
                    {isSufficient ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Margen: +{formatCurrency(diff)}
                      </span>
                    ) : (
                      <span className="text-red-700 dark:text-red-300 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 animate-pulse" /> Faltan {formatCurrency(Math.abs(diff))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Email Alerts Configuration Card */}
      <div className="bg-gradient-to-br from-purple-50/70 via-indigo-50/50 to-white dark:from-surface-950 dark:via-surface-900 dark:to-surface-900 rounded-2xl border border-purple-200/90 dark:border-purple-900/60 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0 shadow-sm">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100">
                  {language === 'ca' ? 'Avisos per Correu davant Venciments' : 'Avisos por Correo Electrónico ante Vencimientos'}
                </h3>
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-sm ${
                    emailAlerts.enabled
                      ? 'bg-emerald-100 text-emerald-950 border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700'
                      : 'bg-surface-200 text-surface-700 border-surface-300 dark:bg-surface-800 dark:text-surface-300 dark:border-surface-700'
                  }`}
                >
                  {emailAlerts.enabled ? '● Activo' : '○ Pausado'}
                </span>
              </div>
              <p className="text-xs text-surface-600 dark:text-surface-400 mt-0.5">
                {language === 'ca'
                  ? `El sistema t'avisa automàticament ${emailAlerts.daysAdvance} dies abans del cobrament per evitar descoberts bancaris.`
                  : `El sistema te avisa automáticamente ${emailAlerts.daysAdvance} días antes del cobro para evitar descubiertos bancarios.`}
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
              <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none rounded-full peer dark:bg-surface-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-surface-600 peer-checked:bg-purple-600"></div>
            </label>
            <span className={`text-xs font-bold ${emailAlerts.enabled ? 'text-purple-700 dark:text-purple-400' : 'text-surface-500'}`}>
              {emailAlerts.enabled ? 'Activado' : 'Desactivado'}
            </span>
          </div>
        </div>

        {emailAlerts.enabled && (
          <div className="pt-3 border-t border-purple-200/50 dark:border-surface-800 flex flex-col md:flex-row items-stretch md:items-end gap-3">
            <div className="flex-1">
              <label className="text-[11px] font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                {language === 'ca' ? 'Adreça de correu per als avisos:' : 'Dirección de correo para los avisos:'}
              </label>
              <Input
                type="email"
                value={emailAlerts.email}
                onChange={(e) => handleUpdateEmailAlerts({ email: e.target.value })}
                placeholder="tu-correo@ejemplo.com"
                className="h-8 text-xs bg-white dark:bg-surface-900 border-purple-200 dark:border-surface-700"
              />
            </div>

            <div className="w-full md:w-56">
              <label className="text-[11px] font-semibold text-surface-700 dark:text-surface-300 block mb-1">
                {language === 'ca' ? 'Antelació del recordatori:' : 'Antelación del recordatorio:'}
              </label>
              <select
                value={emailAlerts.daysAdvance}
                onChange={(e) => handleUpdateEmailAlerts({ daysAdvance: parseInt(e.target.value) || 3 })}
                className="w-full h-8 text-xs px-2.5 rounded-lg border border-purple-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value={1}>{language === 'ca' ? '1 dia abans' : '1 día antes del vencimiento'}</option>
                <option value={3}>{language === 'ca' ? '3 dies abans (Recomanat)' : '3 días antes (Recomendado)'}</option>
                <option value={5}>{language === 'ca' ? '5 dies abans' : '5 días antes del vencimiento'}</option>
                <option value={7}>{language === 'ca' ? '7 dies abans (1 setmana)' : '7 días antes (1 semana)'}</option>
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
                {sendingTestEmail ? 'Enviando email...' : language === 'ca' ? 'Enviar correu de prova' : 'Enviar correo de prueba'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSendTestAlert('client')}
                className="h-8 text-xs font-medium"
                title="Abrir borrador en tu cliente de correo (Gmail, Outlook...)"
                icon={<ExternalLink className="w-3.5 h-3.5" />}
              >
                {language === 'ca' ? 'Obrir al meu correu' : 'Abrir en mi correo'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Add or Edit Debit */}
      <Modal
        open={showDebitModal}
        onOpenChange={setShowDebitModal}
        title={debitIdToEdit ? (language === 'ca' ? 'Editar Venciment' : 'Editar Vencimiento') : (language === 'ca' ? 'Programar Nou Venciment' : 'Programar Nuevo Vencimiento')}
        description={language === 'ca' ? 'Avisa amb antelació perquè el compte tingui el saldo necessari.' : 'Te avisará con antelación para que la cuenta tenga el dinero mínimo necesario.'}
        size="md"
      >
        <form onSubmit={handleSaveDebit} className="space-y-4">
          <Input
            label={language === 'ca' ? 'Concepte del cobrament' : 'Concepto del cobro'}
            placeholder="Ej: Seguro moto, Impuesto de circulación, Cuota Gimnasio..."
            value={debitTitle}
            onChange={(e) => setDebitTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={language === 'ca' ? 'Import del rebut (€)' : 'Importe del recibo (€)'}
              placeholder="0,00"
              suffix="€"
              value={debitAmount}
              onChange={(e) => setDebitAmount(e.target.value)}
              required
            />
            <Select
              label={language === 'ca' ? 'Compte de càrrec' : 'Cuenta de cargo'}
              value={debitBankId}
              onChange={(e) => setDebitBankId(e.target.value)}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={language === 'ca' ? 'Dia del mes de cobrament (1 - 31)' : 'Día del mes de cobro (1 - 31)'}
              type="number"
              min={1}
              max={31}
              value={debitDay.toString()}
              onChange={(e) => setDebitDay(parseInt(e.target.value) || 1)}
              required
            />
            <Select
              label={language === 'ca' ? 'Freqüència' : 'Frecuencia'}
              value={debitRecurrence}
              onChange={(e) => setDebitRecurrence(e.target.value as any)}
              options={[
                { value: 'monthly', label: language === 'ca' ? 'Mensual' : 'Mensual' },
                { value: 'annual', label: language === 'ca' ? 'Anual (un cop l\'any)' : 'Anual (una vez al año)' },
                { value: 'one_time', label: language === 'ca' ? 'Puntual' : 'Puntual' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700 dark:text-surface-300 block mb-1">
              {language === 'ca' ? 'Notes o instruccions (Opcional)' : 'Notas o instrucciones (Opcional)'}
            </label>
            <textarea
              className="w-full text-xs p-2.5 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 focus:outline-none focus:ring-1 focus:ring-purple-500"
              rows={2}
              placeholder="Ej: Pagar antes del 20 para evitar recargos."
              value={debitNotes}
              onChange={(e) => setDebitNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
            <Button variant="ghost" type="button" onClick={() => setShowDebitModal(false)}>
              {language === 'ca' ? 'Cancel·lar' : 'Cancelar'}
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white">
              {debitIdToEdit ? (language === 'ca' ? 'Desar Canvis' : 'Guardar Cambios') : (language === 'ca' ? 'Programar Avís' : 'Programar Aviso')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
