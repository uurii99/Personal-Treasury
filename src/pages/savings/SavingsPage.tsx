import { useState, useEffect } from 'react';
import { Plus, PiggyBank, Target, TrendingUp, Minus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Badge, ProgressBar, EmptyState, Modal } from '@/components/ui';
import { formatCurrency, eurosToCents } from '@/lib/money';
import { getTodayISO, formatDateShort } from '@/lib/dates';
import type { SavingsGoal, SavingsGoalContribution } from '@/types';

export function SavingsPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContributeModal, setShowContributeModal] = useState(false);
  const [activeGoal, setActiveGoal] = useState<SavingsGoal | null>(null);
  const [contributions, setContributions] = useState<SavingsGoalContribution[]>([]);
  const [saving, setSaving] = useState(false);

  // Create form
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');

  // Contribute form
  const [contribAmount, setContribAmount] = useState('');
  const [contribDescription, setContribDescription] = useState('');
  const [contribType, setContribType] = useState<'add' | 'withdraw'>('add');

  const loadGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setGoals(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadGoals(); }, [user]);

  const handleCreate = async () => {
    if (!user || !goalName.trim() || !goalTarget) return;
    setSaving(true);
    try {
      const targetCents = eurosToCents(parseFloat(goalTarget.replace(',', '.')));
      const { error } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        name: goalName.trim(),
        target_amount: targetCents,
        current_amount: 0,
        target_date: goalDate || null,
        status: 'active',
      });
      if (error) { showError('Error al crear'); return; }
      success('Objetivo creado');
      setShowCreateModal(false);
      setGoalName(''); setGoalTarget(''); setGoalDate('');
      loadGoals();
    } finally { setSaving(false); }
  };

  const openContribute = async (goal: SavingsGoal) => {
    setActiveGoal(goal);
    setContribAmount('');
    setContribDescription('');
    setContribType('add');

    const { data } = await supabase
      .from('savings_goal_contributions')
      .select('*')
      .eq('savings_goal_id', goal.id)
      .order('date', { ascending: false })
      .limit(10);
    setContributions(data ?? []);
    setShowContributeModal(true);
  };

  const handleContribute = async () => {
    if (!user || !activeGoal || !contribAmount) return;
    setSaving(true);
    try {
      let amountCents = eurosToCents(parseFloat(contribAmount.replace(',', '.')));
      if (contribType === 'withdraw') amountCents = -amountCents;

      const { error: contribError } = await supabase.from('savings_goal_contributions').insert({
        savings_goal_id: activeGoal.id,
        user_id: user.id,
        amount: amountCents,
        description: contribDescription.trim() || (contribType === 'add' ? 'Aportación' : 'Retirada'),
        date: getTodayISO(),
      });

      if (contribError) { showError('Error'); return; }

      // Update goal current amount
      const newAmount = activeGoal.current_amount + amountCents;
      const newStatus = newAmount >= activeGoal.target_amount ? 'completed' : 'active';

      await supabase.from('savings_goals')
        .update({ current_amount: newAmount, status: newStatus })
        .eq('id', activeGoal.id);

      success(contribType === 'add' ? 'Aportación registrada' : 'Retirada registrada');
      setShowContributeModal(false);
      loadGoals();
    } finally { setSaving(false); }
  };

  const totalSaved = goals.reduce((s, g) => s + Math.max(0, g.current_amount), 0);
  const totalTarget = goals.filter(g => g.status === 'active').reduce((s, g) => s + g.target_amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Ahorros y objetivos</h1>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>
          Nuevo objetivo
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank className="h-4 w-4 text-savings-500" />
            <span className="text-xs text-surface-500">Ahorro total</span>
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-savings-600 dark:text-savings-400">
            {formatCurrency(totalSaved)}
          </p>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-brand-500" />
            <span className="text-xs text-surface-500">Objetivo total</span>
          </div>
          <p className="text-xl font-bold font-mono tabular-nums text-surface-900 dark:text-surface-100">
            {formatCurrency(totalTarget)}
          </p>
        </Card>
      </div>

      {/* Goals */}
      {goals.length === 0 && !loading ? (
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="Sin objetivos de ahorro"
          description="Crea objetivos como fondo de emergencia, viajes, o cualquier meta financiera."
          action={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setShowCreateModal(true)}>Crear objetivo</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {goals.map((goal) => {
            const pct = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
            const remaining = goal.target_amount - goal.current_amount;

            return (
              <Card key={goal.id} hover onClick={() => openContribute(goal)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100">{goal.name}</h3>
                    {goal.target_date && (
                      <p className="text-xs text-surface-400 mt-0.5">Objetivo: {formatDateShort(goal.target_date)}</p>
                    )}
                  </div>
                  <Badge variant={goal.status === 'completed' ? 'success' : goal.status === 'active' ? 'info' : 'default'} size="sm">
                    {goal.status === 'completed' ? 'Completado' : goal.status === 'active' ? 'Activo' : 'Cancelado'}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-500">
                      {formatCurrency(goal.current_amount)} de {formatCurrency(goal.target_amount)}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-surface-700 dark:text-surface-300">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                  <ProgressBar value={goal.current_amount} max={goal.target_amount || 1} size="md" variant="savings" />
                  {remaining > 0 && goal.status === 'active' && (
                    <p className="text-xs text-surface-400">
                      Faltan {formatCurrency(remaining)}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal} title="Nuevo objetivo de ahorro">
        <div className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Fondo de emergencia" value={goalName} onChange={(e) => setGoalName(e.target.value)} autoFocus />
          <Input label="Importe objetivo" placeholder="0,00" suffix="€" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
          <Input label="Fecha objetivo (opcional)" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={saving} disabled={!goalName.trim() || !goalTarget}>Crear</Button>
          </div>
        </div>
      </Modal>

      {/* Contribute modal */}
      <Modal open={showContributeModal} onOpenChange={setShowContributeModal} title={activeGoal?.name ?? 'Objetivo'} size="md">
        {activeGoal && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-50 dark:bg-surface-800/50">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-surface-500">Progreso</span>
                <span className="font-mono tabular-nums font-semibold">
                  {formatCurrency(activeGoal.current_amount)} / {formatCurrency(activeGoal.target_amount)}
                </span>
              </div>
              <ProgressBar value={activeGoal.current_amount} max={activeGoal.target_amount || 1} variant="savings" />
            </div>

            <div className="flex gap-2 mb-2">
              <Button
                variant={contribType === 'add' ? 'success' : 'outline'}
                size="sm"
                onClick={() => setContribType('add')}
                icon={<TrendingUp className="h-3.5 w-3.5" />}
              >
                Aportar
              </Button>
              <Button
                variant={contribType === 'withdraw' ? 'danger' : 'outline'}
                size="sm"
                onClick={() => setContribType('withdraw')}
                icon={<Minus className="h-3.5 w-3.5" />}
              >
                Retirar
              </Button>
            </div>

            <Input label="Importe" placeholder="0,00" suffix="€" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
            <Input label="Descripción (opcional)" placeholder="Descripción..." value={contribDescription} onChange={(e) => setContribDescription(e.target.value)} />

            {/* Recent contributions */}
            {contributions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-500 mb-2">Últimos movimientos</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {contributions.map((c) => (
                    <div key={c.id} className="flex justify-between text-xs py-1">
                      <span className="text-surface-600 dark:text-surface-400">{c.description} · {formatDateShort(c.date)}</span>
                      <span className={`font-mono tabular-nums font-medium ${c.amount >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                        {c.amount >= 0 ? '+' : ''}{formatCurrency(c.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowContributeModal(false)}>Cancelar</Button>
              <Button onClick={handleContribute} loading={saving} disabled={!contribAmount} variant={contribType === 'add' ? 'success' : 'danger'}>
                {contribType === 'add' ? 'Aportar' : 'Retirar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
