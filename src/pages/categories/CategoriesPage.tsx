import { useState, useEffect } from 'react';
import { Plus, Pencil, Archive, Tag } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Select, Badge, EmptyState, Modal, ConfirmDialog } from '@/components/ui';
import type { Category, BudgetSection } from '@/types';
import { BUDGET_SECTION_LABELS } from '@/types';

export function CategoriesPage() {
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [section, setSection] = useState<string>('leisure');
  const [saving, setSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const loadCategories = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('section')
      .order('sort_order');
    setCategories(data ?? []);
    setLoading(false);
  };

  useEffect(() => { loadCategories(); }, [user]);

  const openCreate = () => {
    setEditTarget(null);
    setName('');
    setSection('leisure');
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setName(cat.name);
    setSection(cat.section);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !name.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        const { error } = await supabase
          .from('categories')
          .update({ name: name.trim(), section })
          .eq('id', editTarget.id);
        if (error) { showError('Error al guardar'); return; }
        success('Categoría actualizada');
      } else {
        const maxOrder = categories.length;
        const { error } = await supabase.from('categories').insert({
          user_id: user.id,
          name: name.trim(),
          section,
          sort_order: maxOrder,
        });
        if (error) { showError('Error al crear'); return; }
        success('Categoría creada');
      }
      setShowModal(false);
      loadCategories();
    } finally { setSaving(false); }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    const { error } = await supabase
      .from('categories')
      .update({ is_archived: !archiveTarget.is_archived })
      .eq('id', archiveTarget.id);
    if (error) showError('Error');
    else success(archiveTarget.is_archived ? 'Categoría restaurada' : 'Categoría archivada');
    setArchiveTarget(null);
    loadCategories();
  };

  const displayedCategories = categories.filter((c) => showArchived || !c.is_archived);
  const groupedBySection = (['fixed', 'leisure', 'savings'] as BudgetSection[]).map((s) => ({
    section: s,
    categories: displayedCategories.filter((c) => c.section === s),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-surface-900 dark:text-surface-100">Categorías</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Ocultar archivadas' : 'Mostrar archivadas'}
          </Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={openCreate}>Nueva categoría</Button>
        </div>
      </div>

      {groupedBySection.map(({ section: s, categories: cats }) => (
        <Card key={s}>
          <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-100 mb-3">
            {BUDGET_SECTION_LABELS[s]}
          </h3>
          {cats.length === 0 ? (
            <p className="text-sm text-surface-400 py-2">Sin categorías en este apartado.</p>
          ) : (
            <div className="space-y-1">
              {cats.map((cat) => (
                <div
                  key={cat.id}
                  className={`flex items-center justify-between py-2 px-3 -mx-3 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800/50 group ${cat.is_archived ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-surface-400" />
                    <span className="text-sm font-medium text-surface-900 dark:text-surface-100">{cat.name}</span>
                    {cat.is_archived && <Badge size="sm">Archivada</Badge>}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(cat)} className="p-1.5 rounded text-surface-400 hover:text-brand-600" aria-label="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setArchiveTarget(cat)} className="p-1.5 rounded text-surface-400 hover:text-warning-500" aria-label="Archivar">
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {/* Create/Edit modal */}
      <Modal open={showModal} onOpenChange={setShowModal} title={editTarget ? 'Editar categoría' : 'Nueva categoría'}>
        <div className="space-y-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Nombre de la categoría" />
          <Select
            label="Apartado"
            options={Object.entries(BUDGET_SECTION_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            value={section}
            onChange={(e) => setSection(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>Guardar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={() => setArchiveTarget(null)}
        title={archiveTarget?.is_archived ? 'Restaurar categoría' : 'Archivar categoría'}
        description={archiveTarget?.is_archived
          ? 'La categoría volverá a estar disponible para nuevos movimientos.'
          : 'La categoría se ocultará pero sus movimientos históricos se conservarán.'}
        confirmLabel={archiveTarget?.is_archived ? 'Restaurar' : 'Archivar'}
        variant="primary"
        onConfirm={handleArchive}
      />
    </div>
  );
}
