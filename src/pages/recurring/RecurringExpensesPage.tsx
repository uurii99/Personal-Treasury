import { useState, useEffect } from 'react';
import { Plus, Repeat, Check, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Select, Badge, EmptyState, Modal } from '@/components/ui';
import { formatCurrency, eurosToCents, distributeAcrossInstallments } from '@/lib/money';
import { getTodayISO } from '@/lib/dates';
import type { RecurringExpense, Category, BudgetSection } from '@/types';
import { BUDGET_SECTION_LABELS, RECURRENCE_LABELS, type RecurrenceFrequency } from '@/types';

export function RecurringExpensesPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [expenses, setExpenses] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [frequency, setFrequency] = useState<string>('annual');
  const [numInstallments, setNumInstallments] = useState('12');
  const [section, setSection] = useState('fixed');
  const [categoryId, setCategoryId] = useState('');
  const [startDate, setStartDate] = useState(getTodayISO());
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: exp }, { data: cats }] = await Promise.all([
      supabase.from('recurring_expenses').select('*, category:categories(name)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).eq('is_archived', false),
    ]);
    setExpenses(exp ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleCreate = async () => {
    if (!user || !name.trim() || !totalAmount) return;
    setSaving(true);
    try {
      const amountCents = eurosToCents(parseFloat(totalAmount.replace(',', '.')));
      const installments = parseInt(numInstallments) || 12;

      const { data: expense, error } = await supabase.from('recurring_expenses').insert({
        user_id: user.id,
        name: name.trim(),
        total_amount: amountCents,
        frequency,
        start_date: startDate,
        num_installments: installments,
        section,
        category_id: categoryId || null,
        status: 'active',
        notes: notes.trim() || null,
      }).select().single();

      if (error) { showError('Error al crear'); return; }

      // Create installments
      if (expense) {
        const amounts = distributeAcrossInstallments(amountCents, installments);
        const startDateObj = new Date(startDate + 'T00:00:00');
        const installmentRows = amounts.map((amt, i) => {
          const d = new Date(startDateObj);
          d.setMonth(d.getMonth() + i);
          return {
            recurring_expense_id: expense.id,
            user_id: user.id,
            month: d.getMonth() + 1,
            year: d.getFullYear(),
            amount: amt,
            is_paid: false,
          };
        });

        await supabase.from('recurring_expense_installments').insert(installmentRows);
      }

      success('Gasto periódico creado');
      setShowModal(false);
      resetForm();
      loadData();
    } catch { showError('Error inesperado'); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setName(''); setTotalAmount(''); setFrequency('annual');
    setNumInstallments('12'); setSection('fixed'); setCategoryId('');
    setStartDate(getTodayISO()); setNotes('');
  };

  // Preview
  const previewAmount = totalAmount ? eurosToCents(parseFloat(totalAmount.replace(',', '.')) || 0) : 0;
  const previewInstallments = parseInt(numInstallments) || 1;
  const monthlyPreview = previewAmount > 0 ? Math.floor(previewAmount / previewInstallments) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Gastos periódicos</h1>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => { resetForm(); setShowModal(true); }}>
          Nuevo gasto periódico
        </Button>
      </div>

      {expenses.length === 0 && !loading ? (
        <EmptyState
          icon={<Repeat className="h-6 w-6" />}
          title="Sin gastos periódicos"
          description="Crea gastos anuales, semestrales o trimestrales y distribúyelos entre varios meses."
          action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowModal(true)}>Crear primero</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {expenses.map((exp) => (
            <Card key={exp.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{exp.name}</h3>
                    <Badge size="sm" variant={exp.status === 'active' ? 'success' : 'default'}>
                      {exp.status === 'active' ? 'Activo' : exp.status === 'completed' ? 'Completado' : 'Cancelado'}
                    </Badge>
                    <Badge size="sm">{RECURRENCE_LABELS[exp.frequency as RecurrenceFrequency]}</Badge>
                  </div>
                  <p className="text-xs text-surface-500">
                    {exp.category?.name ?? BUDGET_SECTION_LABELS[exp.section as BudgetSection]} · {exp.num_installments} cuotas
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold font-mono tabular-nums text-surface-900 dark:text-surface-100">
                    {formatCurrency(exp.total_amount)}
                  </p>
                  <p className="text-xs text-surface-500">
                    ≈ {formatCurrency(Math.floor(exp.total_amount / exp.num_installments))}/mes
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onOpenChange={setShowModal} title="Nuevo gasto periódico" size="lg">
        <div className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Seguro de moto" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Importe total" placeholder="0,00" suffix="€" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
            <Select
              label="Frecuencia"
              options={Object.entries(RECURRENCE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Número de cuotas" type="number" min="1" max="60" value={numInstallments} onChange={(e) => setNumInstallments(e.target.value)} />
            <Input label="Fecha de inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Select
            label="Apartado"
            options={Object.entries(BUDGET_SECTION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
          <Input label="Notas (opcional)" placeholder="Notas..." value={notes} onChange={(e) => setNotes(e.target.value)} />

          {monthlyPreview > 0 && (
            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
              <p className="text-xs text-surface-500">
                Reserva mensual estimada: <span className="font-semibold text-surface-900 dark:text-surface-100">{formatCurrency(monthlyPreview)}</span>/mes
                durante {previewInstallments} meses
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!name.trim() || !totalAmount}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
