import { useState, useEffect, useCallback } from 'react';
import { Search, Download, Trash2, Receipt } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Select, Badge, EmptyState, ConfirmDialog, SkeletonTable } from '@/components/ui';
import { formatCurrency } from '@/lib/money';
import { formatDateShort } from '@/lib/dates';
import type { Transaction, BudgetSection } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

export function HistoryPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('transactions')
        .select('*, category:categories(id, name, section)')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(200);
      setTransactions(data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = transactions.filter((t) => {
    if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (sectionFilter && t.section !== sectionFilter) return false;
    if (typeFilter && t.type !== typeFilter) return false;
    return true;
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', deleteTarget);
      if (error) showError('Error al eliminar');
      else { success('Movimiento eliminado'); loadData(); }
    } finally { setDeleting(false); setDeleteTarget(null); }
  };

  const handleExportCSV = () => {
    const headers = ['Fecha', 'Descripción', 'Tipo', 'Apartado', 'Categoría', 'Importe'];
    const rows = filtered.map((t) => [
      t.date,
      t.description,
      t.type === 'expense' ? 'Gasto' : 'Ingreso',
      BUDGET_SECTION_LABELS[t.section as BudgetSection],
      t.category?.name ?? '',
      (t.amount / 100).toFixed(2).replace('.', ','),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `movimientos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Historial de movimientos</h1>
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={handleExportCSV}>
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Buscar movimientos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} icon={<Search className="h-4 w-4" />} />
        </div>
        <Select
          options={[
            { value: '', label: 'Todos los apartados' },
            { value: 'fixed', label: 'Gastos fijos' },
            { value: 'leisure', label: 'Ocio y variables' },
            { value: 'savings', label: 'Ahorros' },
          ]}
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
        />
        <Select
          options={[
            { value: '', label: 'Todos los tipos' },
            { value: 'expense', label: 'Gastos' },
            { value: 'income', label: 'Ingresos' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
      </div>

      {/* Transactions */}
      <Card padding="none">
        {loading ? (
          <div className="p-4"><SkeletonTable rows={8} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="Sin resultados"
            description={searchQuery ? 'Prueba con otros términos de búsqueda.' : 'Aún no hay movimientos registrados.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="treasury-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Apartado</th>
                  <th>Categoría</th>
                  <th className="text-right">Importe</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="group">
                    <td className="text-xs text-surface-500 tabular-nums whitespace-nowrap">{formatDateShort(t.date)}</td>
                    <td className="font-medium text-surface-900 dark:text-surface-100">{t.description}</td>
                    <td>
                      <Badge size="sm" variant={t.section === 'fixed' ? 'info' : t.section === 'savings' ? 'savings' : 'warning'}>
                        {BUDGET_SECTION_LABELS[t.section as BudgetSection]}
                      </Badge>
                    </td>
                    <td className="text-surface-500">{t.category?.name ?? '—'}</td>
                    <td className={`amount-cell font-mono font-semibold tabular-nums ${t.type === 'expense' ? 'amount-negative' : 'amount-positive'}`}>
                      {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                    </td>
                    <td>
                      <button
                        onClick={() => setDeleteTarget(t.id)}
                        className="p-1 rounded text-surface-300 hover:text-danger-500 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Eliminar movimiento"
        description="¿Seguro que quieres eliminar este movimiento? Los totales se recalcularán automáticamente."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
