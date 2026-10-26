import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, Button, Input, ConfirmDialog } from '@/components/ui';
import { User, Shield, Download, Trash2, FileSpreadsheet, Sparkles, CheckCircle2 } from 'lucide-react';
import { isUuriiProfile, syncUuriiExcelData } from '@/lib/syncUuriiExcel';

export function ProfilePage() {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { success, error: showError } = useToast();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [syncingExcel, setSyncingExcel] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isUurii = isUuriiProfile(user, profile) || displayName.toLowerCase().includes('uurii99');

  const handleSaveName = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    const { error } = await updateProfile({ display_name: displayName.trim() });
    if (error) showError('Error al guardar');
    else success('Perfil actualizado');
    setSaving(false);
  };

  const handleSyncExcel = async () => {
    if (!user) return;
    setSyncingExcel(true);
    const res = await syncUuriiExcelData(user, profile, true);
    if (res.success) {
      success('Sincronizado', res.message);
    } else {
      showError(res.message);
    }
    setSyncingExcel(false);
  };

  const handleExportJSON = async () => {
    if (!user) return;
    try {
      const [{ data: profile }, { data: settings }, { data: incomes }, { data: transactions }, { data: categories }, { data: goals }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('user_settings').select('*').eq('user_id', user.id).single(),
        supabase.from('income_entries').select('*').eq('user_id', user.id),
        supabase.from('transactions').select('*').eq('user_id', user.id),
        supabase.from('categories').select('*').eq('user_id', user.id),
        supabase.from('savings_goals').select('*').eq('user_id', user.id),
      ]);

      const exportData = { profile, settings, incomes, transactions, categories, goals, exported_at: new Date().toISOString() };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `personal-treasury-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success('Datos exportados');
    } catch {
      showError('Error al exportar');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Delete user data (cascading deletes should handle most)
      await supabase.from('transactions').delete().eq('user_id', user.id);
      await supabase.from('income_entries').delete().eq('user_id', user.id);
      await supabase.from('savings_goal_contributions').delete().eq('user_id', user.id);
      await supabase.from('savings_goals').delete().eq('user_id', user.id);
      await supabase.from('recurring_expense_installments').delete().eq('user_id', user.id);
      await supabase.from('recurring_expenses').delete().eq('user_id', user.id);
      await supabase.from('budget_transfers').delete().eq('user_id', user.id);
      await supabase.from('categories').delete().eq('user_id', user.id);
      await supabase.from('user_settings').delete().eq('user_id', user.id);
      await supabase.from('profiles').delete().eq('id', user.id);

      await signOut();
    } catch {
      showError('Error al eliminar la cuenta. Contacta con el administrador.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Perfil y privacidad</h1>

      {/* Profile info */}
      <Card>
        <CardHeader title="Información personal" icon={<User className="h-5 w-5" />} />
        <div className="space-y-4">
          <Input label="Correo electrónico" value={user?.email ?? ''} disabled />
          <Input label="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <div className="flex justify-end">
            <Button onClick={handleSaveName} loading={saving} disabled={!displayName.trim()}>
              Guardar nombre
            </Button>
          </div>
        </div>
      </Card>

      {/* TRESORERIA URI Excel (uurii99_ profile exclusive) */}
      {isUurii && (
        <Card className="border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/20 dark:bg-emerald-950/10">
          <CardHeader
            title="Excel TRESORERIA URI (uurii99_)"
            description="Tus datos iniciales del archivo TRESORERIA URI.xlsx contabilizados a partir de este mes (Octubre 2026)."
            icon={<FileSpreadsheet className="h-5 w-5 text-emerald-600" />}
          />
          <div className="space-y-3">
            <p className="text-xs text-surface-600 dark:text-surface-300">
              Incluye: Nòmina (723,98 €), Gym fijo (49,95 €), Corte de pelo (13 €), Otros (12 €), Comidas (18,58 € con desglose), Regalos (30,27 €), Piezas moto (200,08 €), Gasolina moto (13,41 €), Hot Wheels (75,60 €) e Inversiones (108,60 €).
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="outline"
                className="border-emerald-600 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60"
                icon={<Sparkles className="h-4 w-4 text-emerald-600" />}
                onClick={handleSyncExcel}
                loading={syncingExcel}
              >
                Sincronizar datos (Octubre 2026)
              </Button>
              {localStorage.getItem(`uurii_excel_synced_${user?.id}_2026_10`) === 'true' && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  Sincronizado correctamente
                </span>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Data export */}
      <Card>
        <CardHeader title="Tus datos" description="Exporta o elimina tus datos personales." icon={<Shield className="h-5 w-5" />} />
        <div className="space-y-3">
          <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={handleExportJSON}>
            Exportar datos (JSON)
          </Button>
          <p className="text-xs text-surface-400">
            Descarga todos tus datos en formato JSON, incluyendo perfil, ingresos, gastos, categorías y objetivos.
          </p>
        </div>
      </Card>

      {/* Delete account */}
      <Card className="border-danger-200 dark:border-danger-800/50">
        <CardHeader title="Zona peligrosa" description="Acciones irreversibles sobre tu cuenta." />
        <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setShowDeleteConfirm(true)}>
          Eliminar mi cuenta y todos mis datos
        </Button>
        <p className="text-xs text-surface-400 mt-2">
          Esta acción eliminará permanentemente tu cuenta y todos los datos asociados. No se puede deshacer.
        </p>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Eliminar cuenta"
        description="¿Estás seguro de que quieres eliminar tu cuenta y todos tus datos financieros? Esta acción es irreversible. Te recomendamos exportar tus datos antes."
        confirmLabel="Eliminar permanentemente"
        loading={deleting}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
