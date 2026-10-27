import { useState, useEffect, useMemo } from 'react';
import {
  Target,
  Plus,
  CheckCircle2,
  Trophy,
  Calendar,
  Sparkles,
  Car,
  TrendingUp,
  Edit2,
  Trash2,
  PiggyBank,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, Button, Input, Select, ProgressBar, Modal } from '@/components/ui';
import { formatCurrency, eurosToCents, centsToEuros } from '@/lib/money';
import { getCurrentMonthYear } from '@/lib/dates';
import type { AnnualGoal } from '@/types';

const STORAGE_KEY_GOALS = 'pt_annual_goals_';

const DEFAULT_GOALS: Omit<AnnualGoal, 'user_id'>[] = [
  {
    id: 'g-coche',
    title: 'Ahorro para Coche / Moto',
    section: 'leisure',
    target_amount: 100000, // 1.000,00 €
    current_amount: 75000, // 750,00 €
    target_year: 2026,
    status: 'active',
    notes: 'Ahorro planificado dentro de la partida de ocio y gastos variables.',
  },
  {
    id: 'g-fondo',
    title: 'Fondo de Emergencia',
    section: 'savings',
    target_amount: 300000, // 3.000,00 €
    current_amount: 220000, // 2.200,00 €
    target_year: 2026,
    status: 'active',
    notes: 'Objetivo de seguridad de 3 a 6 meses de gastos fijos.',
  },
  {
    id: 'g-viaje',
    title: 'Viaje de Vacaciones Verano',
    section: 'leisure',
    target_amount: 80000, // 800,00 €
    current_amount: 80000, // 800,00 € (¡Conseguida!)
    target_year: 2026,
    status: 'completed',
    notes: 'Escapada de verano.',
  },
];

export function GoalsPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { t } = useLanguage();
  const currentMY = getCurrentMonthYear();

  const [goals, setGoals] = useState<AnnualGoal[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<AnnualGoal | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [currentAmount, setCurrentAmount] = useState('');
  const [section, setSection] = useState<'leisure' | 'savings'>('leisure');
  const [notes, setNotes] = useState('');

  // Quick contribute modal
  const [contributeGoal, setContributeGoal] = useState<AnnualGoal | null>(null);
  const [contributeAmount, setContributeAmount] = useState('');

  const loadGoals = () => {
    if (!user) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GOALS + user.id);
      if (!raw) {
        const initial = DEFAULT_GOALS.map((g) => ({ ...g, user_id: user.id }));
        localStorage.setItem(STORAGE_KEY_GOALS + user.id, JSON.stringify(initial));
        setGoals(initial);
      } else {
        setGoals(JSON.parse(raw));
      }
    } catch {
      setGoals(DEFAULT_GOALS.map((g) => ({ ...g, user_id: user.id })));
    }
  };

  useEffect(() => {
    loadGoals();
  }, [user]);

  const saveGoalsToStorage = (updated: AnnualGoal[]) => {
    if (!user) return;
    localStorage.setItem(STORAGE_KEY_GOALS + user.id, JSON.stringify(updated));
    setGoals(updated);
  };

  const completedGoalsCount = useMemo(() => {
    return goals.filter((g) => g.current_amount >= g.target_amount || g.status === 'completed').length;
  }, [goals]);

  const totalTargetCents = useMemo(() => {
    return goals.reduce((sum, g) => sum + g.target_amount, 0);
  }, [goals]);

  const totalSavedCents = useMemo(() => {
    return goals.reduce((sum, g) => sum + g.current_amount, 0);
  }, [goals]);

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      showError('Introduce el título de la meta');
      return;
    }

    const targetParsed = parseFloat(targetAmount.replace(',', '.'));
    if (isNaN(targetParsed) || targetParsed <= 0) {
      showError('Introduce un importe objetivo válido');
      return;
    }

    const currentParsed = currentAmount.trim() ? parseFloat(currentAmount.replace(',', '.')) : 0;
    const targetCents = eurosToCents(targetParsed);
    const currentCents = eurosToCents(isNaN(currentParsed) ? 0 : currentParsed);

    let updated: AnnualGoal[];
    if (editingGoal) {
      updated = goals.map((g) =>
        g.id === editingGoal.id
          ? {
              ...g,
              title: trimmedTitle,
              target_amount: targetCents,
              current_amount: currentCents,
              section,
              notes: notes.trim() || null,
              status: currentCents >= targetCents ? 'completed' : 'active',
            }
          : g
      );
      success('Meta actualizada', trimmedTitle);
    } else {
      const newGoal: AnnualGoal = {
        id: 'goal_' + Date.now(),
        user_id: user.id,
        title: trimmedTitle,
        target_amount: targetCents,
        current_amount: currentCents,
        target_year: currentMY.year,
        section,
        notes: notes.trim() || null,
        status: currentCents >= targetCents ? 'completed' : 'active',
      };
      updated = [...goals, newGoal];
      success('Nueva meta creada', trimmedTitle);
    }

    saveGoalsToStorage(updated);
    setShowModal(false);
    setEditingGoal(null);
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    saveGoalsToStorage(updated);
    success('Meta eliminada');
  };

  const handleOpenEdit = (goal: AnnualGoal) => {
    setEditingGoal(goal);
    setTitle(goal.title);
    setTargetAmount(centsToEuros(goal.target_amount).toString().replace('.', ','));
    setCurrentAmount(centsToEuros(goal.current_amount).toString().replace('.', ','));
    setSection(goal.section);
    setNotes(goal.notes || '');
    setShowModal(true);
  };

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setTitle('');
    setTargetAmount('');
    setCurrentAmount('');
    setSection('leisure');
    setNotes('');
    setShowModal(true);
  };

  const handleContribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoal) return;
    const parsed = parseFloat(contributeAmount.replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) {
      showError('Importe inválido');
      return;
    }
    const centsToAdd = eurosToCents(parsed);
    const newTotal = contributeGoal.current_amount + centsToAdd;

    const updated = goals.map((g) =>
      g.id === contributeGoal.id
        ? {
            ...g,
            current_amount: newTotal,
            status: newTotal >= g.target_amount ? ('completed' as const) : g.status,
          }
        : g
    );

    saveGoalsToStorage(updated);
    setContributeGoal(null);
    setContributeAmount('');
    success('Aportación guardada', `+${parsed.toFixed(2)} € a ${contributeGoal.title}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">{t.goals.title}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-200 dark:bg-surface-800 text-surface-900 dark:text-white font-bold border border-surface-300 dark:border-surface-700 shadow-xs">
              Año {currentMY.year}
            </span>
          </div>
          <p className="text-sm text-surface-500 mt-1">{t.goals.subtitle}</p>
        </div>

        <Button icon={<Plus className="h-4 w-4" />} onClick={handleOpenCreate}>
          {t.goals.addGoal}
        </Button>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-purple-700 to-indigo-800 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
            Metas del Año {currentMY.year}
          </span>
          <p className="text-3xl font-extrabold font-mono mt-1">
            {completedGoalsCount} de {goals.length} conseguidas
          </p>
          <p className="text-xs text-purple-200 mt-2">
            {goals.length > 0
              ? `${Math.round((completedGoalsCount / goals.length) * 100)}% de tus objetivos cumplidos`
              : 'Empieza definiendo tu primera meta'}
          </p>
        </div>

        <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-surface-500 font-medium">Total ahorrado hacia metas</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(totalSavedCents)}
          </p>
          <span className="text-xs text-surface-400 mt-2">De {formatCurrency(totalTargetCents)} fijados</span>
        </div>

        <div className="bg-white dark:bg-surface-900 p-5 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-surface-500 font-medium">Restante para completar todas</span>
          <p className="text-2xl font-bold font-mono text-surface-900 dark:text-surface-100 mt-1 tabular-nums">
            {formatCurrency(Math.max(0, totalTargetCents - totalSavedCents))}
          </p>
          <span className="text-xs text-surface-400 mt-2">Meses restantes del año: {13 - currentMY.month}</span>
        </div>
      </div>

      {/* Goals Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const isDone = goal.current_amount >= goal.target_amount;
          const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
          const remaining = Math.max(0, goal.target_amount - goal.current_amount);
          const monthsLeft = Math.max(1, 13 - currentMY.month);
          const monthlyTarget = Math.round(remaining / monthsLeft);

          return (
            <div
              key={goal.id}
              className={`bg-white dark:bg-surface-900 rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between ${
                isDone
                  ? 'border-emerald-300 dark:border-emerald-900/60 ring-2 ring-emerald-500/20'
                  : 'border-surface-200 dark:border-surface-800'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                        isDone ? 'bg-emerald-600' : 'bg-brand-600'
                      }`}
                    >
                      {isDone ? <Trophy className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 leading-tight">
                        {goal.title}
                      </h3>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-surface-400">
                        {goal.section === 'leisure' ? 'En Ocio y Variables' : 'En Ahorro e Inversión'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300'
                    }`}
                  >
                    {isDone ? '¡Conseguida! 🎉' : `${pct}%`}
                  </span>
                </div>

                {goal.notes && <p className="text-xs text-surface-500 line-clamp-2 my-2">{goal.notes}</p>}

                {/* Progress bar */}
                <div className="my-3 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-surface-500">Ahorrado:</span>
                    <span className="font-mono font-bold text-surface-900 dark:text-surface-100">
                      {formatCurrency(goal.current_amount)} / {formatCurrency(goal.target_amount)}
                    </span>
                  </div>
                  <ProgressBar value={goal.current_amount} max={goal.target_amount} size="md" />
                </div>

                {/* Remaining Info */}
                {!isDone && (
                  <div className="bg-surface-50 dark:bg-surface-800/60 p-2.5 rounded-xl border border-surface-200/60 dark:border-surface-700/60 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-surface-500">Faltan para completar:</span>
                      <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-surface-400">
                      <span>Ahorro mensual necesario:</span>
                      <span className="font-mono font-semibold">{formatCurrency(monthlyTarget)} / mes</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-surface-100 dark:border-surface-800 mt-4 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="outline"
                  icon={<Plus className="h-3.5 w-3.5" />}
                  onClick={() => {
                    setContributeGoal(goal);
                    setContributeAmount('');
                  }}
                >
                  Aportar
                </Button>

                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenEdit(goal)}
                    className="p-1.5 rounded text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
                    title="Editar meta"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="p-1.5 rounded text-danger-400 hover:text-danger-600"
                    title="Eliminar meta"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create / Edit Goal Modal */}
      <Modal
        open={showModal}
        onOpenChange={setShowModal}
        title={editingGoal ? 'Editar Meta' : 'Crear Nueva Meta Anual'}
        description="Fija una meta de ahorro para este año (ej. 1.000€ para un coche en ocio)."
        size="md"
      >
        <form onSubmit={handleSaveGoal} className="space-y-4">
          <Input
            label="Título de la meta"
            placeholder="Ej: Ahorro coche 1.000€, Viaje Japón, Fondo emergencia..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Importe objetivo (€)"
              placeholder="1000,00"
              suffix="€"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
            />
            <Input
              label="Ahorrado ya (€)"
              placeholder="0,00"
              suffix="€"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
            />
          </div>

          <Select
            label="¿Dentro de qué partida presupuestaria?"
            value={section}
            onChange={(e) => setSection(e.target.value as any)}
            options={[
              { value: 'leisure', label: '🟡 Ocio y Variables (ej. coche, caprichos, viajes)' },
              { value: 'savings', label: '🟣 Ahorro e Inversión (ej. fondo emergencia, patrimonio)' },
            ]}
          />

          <Input
            label="Notas o detalles"
            placeholder="Ej: Ahorro para dar la entrada o pagar el seguro..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-surface-200 dark:border-surface-800">
            <Button variant="ghost" type="button" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar Meta</Button>
          </div>
        </form>
      </Modal>

      {/* Contribute Modal */}
      <Modal
        open={!!contributeGoal}
        onOpenChange={(open) => !open && setContributeGoal(null)}
        title={`Aportar a: ${contributeGoal?.title}`}
        description="Suma una aportación al saldo ahorrado de esta meta."
        size="sm"
      >
        <form onSubmit={handleContribute} className="space-y-4">
          <Input
            label="Importe a añadir (€)"
            placeholder="50,00"
            suffix="€"
            value={contributeAmount}
            onChange={(e) => setContributeAmount(e.target.value)}
            autoFocus
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-200 dark:border-surface-800">
            <Button variant="ghost" type="button" onClick={() => setContributeGoal(null)}>
              Cancelar
            </Button>
            <Button type="submit">Confirmar Aportación</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
