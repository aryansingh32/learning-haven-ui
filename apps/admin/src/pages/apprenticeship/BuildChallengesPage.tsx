import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { buildHavenAdminApi } from '@/services/build-haven.service';
import { MarkdownPreview } from '@/components/build-haven/MarkdownPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';

type TabKey = 'overview' | 'stages' | 'languages' | 'vibe_config' | 'preview' | 'analytics';

function SortableStageRow({
  stage,
  onEdit,
  onDelete,
}: {
  stage: any;
  onEdit: (stage: any) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-lg border bg-card p-3 ${isDragging ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        className="mt-1 cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">#{stage.stage_number}</span>
          <span className="font-medium">{stage.title}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {stage.difficulty || 'medium'}
          </Badge>
          {!stage.is_active ? <Badge variant="secondary">inactive</Badge> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{stage.test_command || '—'}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(stage)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(stage.id)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default function BuildChallengesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({
    title: '',
    slug: '',
    description: '',
    short_tagline: '',
    thumbnail_url: '',
    difficulty_level: 'beginner',
    status: 'draft',
    is_free: false,
    supported_languages: 'python,nodejs',
    what_you_build: '',
    what_you_learn: '',
    why_build: '',
    prerequisites_content: '',
    duration_days: 30,
    price_inr: 0,
    // Dual-mode
    available_modes: ['traditional'] as string[],
    default_mode: 'traditional',
    reference_demo_url: '',
    product_contract: '',
  });
  const [stageItems, setStageItems] = useState<any[]>([]);
  const [stageForm, setStageForm] = useState({
    stage_number: 1,
    title: '',
    difficulty: 'medium',
    description: '',
    instructions: '',
    code_example: '',
    hintsText: '',
    test_command: '',
    docker_test_image: '',
    timeout_seconds: 120,
    expected_exit_code: 0,
    success_criteria_json: '{}',
    docs_url: '',
    concepts_content: '',
    estimated_minutes: 30,
    // Vibe mode
    verification_type: 'docker_test',
    acceptance_contract_json: '{}',
  });
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [languageForm, setLanguageForm] = useState({
    language: '',
    starter_repo_url: '',
    docker_test_image: '',
    setup_instructions: '',
  });
  const [editingLanguageId, setEditingLanguageId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const challengesQuery = useQuery({
    queryKey: ['admin-build-challenges'],
    queryFn: () => buildHavenAdminApi.listChallenges(),
  });

  const detailQuery = useQuery({
    queryKey: ['admin-build-challenge', selectedId],
    queryFn: () => buildHavenAdminApi.getChallenge(selectedId),
    enabled: Boolean(selectedId),
  });

  const analyticsQuery = useQuery({
    queryKey: ['admin-build-challenge-analytics', selectedId],
    queryFn: () => buildHavenAdminApi.getAnalytics(selectedId),
    enabled: Boolean(selectedId) && tab === 'analytics',
  });

  const filteredChallenges = useMemo(() => {
    const list = challengesQuery.data?.challenges || [];
    if (filterStatus === 'all') return list.filter((c: any) => c.status !== 'archived');
    return list.filter((c: any) => c.status === filterStatus);
  }, [challengesQuery.data?.challenges, filterStatus]);

  useEffect(() => {
    const stages = detailQuery.data?.stages || [];
    setStageItems([...stages].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
  }, [detailQuery.data?.stages]);

  const createMutation = useMutation({
    mutationFn: () =>
      buildHavenAdminApi.createChallenge({
        ...form,
        is_free: Boolean(form.is_free),
        duration_days: Number(form.duration_days) || 30,
        price_inr: Number(form.price_inr) || 0,
        supported_languages: form.supported_languages.split(',').map((v) => v.trim()).filter(Boolean),
        available_modes: form.available_modes,
        default_mode: form.default_mode,
        reference_demo_url: form.reference_demo_url || null,
        product_contract: form.product_contract || null,
      }),
    onSuccess: async (data: any) => {
      toast.success('Challenge created');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenges'] });
      if (data?.challenge?.id) setSelectedId(data.challenge.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      buildHavenAdminApi.updateChallenge(selectedId, {
        ...form,
        is_free: Boolean(form.is_free),
        duration_days: Number(form.duration_days) || 30,
        price_inr: Number(form.price_inr) || 0,
        supported_languages: form.supported_languages.split(',').map((v) => v.trim()).filter(Boolean),
        available_modes: form.available_modes,
        default_mode: form.default_mode,
        reference_demo_url: form.reference_demo_url || null,
        product_contract: form.product_contract || null,
      }),
    onSuccess: async () => {
      toast.success('Saved');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenges'] });
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stageCreateMutation = useMutation({
    mutationFn: () => {
      let hints: string[] = [];
      try {
        hints = stageForm.hintsText
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
      } catch {
        hints = [];
      }
      let success_criteria: Record<string, unknown> = {};
      try {
        success_criteria = JSON.parse(stageForm.success_criteria_json || '{}');
      } catch {
        throw new Error('success_criteria must be valid JSON');
      }
      let acceptance_contract: Record<string, unknown> = {};
      try {
        acceptance_contract = JSON.parse(stageForm.acceptance_contract_json || '{}');
      } catch {
        throw new Error('acceptance_contract must be valid JSON');
      }
      return buildHavenAdminApi.createStage(selectedId, {
        stage_number: Number(stageForm.stage_number) || 1,
        title: stageForm.title,
        difficulty: stageForm.difficulty,
        description: stageForm.description || null,
        instructions: stageForm.instructions || null,
        code_example: stageForm.code_example || null,
        hints,
        test_command: stageForm.test_command || null,
        docker_test_image: stageForm.docker_test_image || null,
        timeout_seconds: Number(stageForm.timeout_seconds) || 120,
        expected_exit_code: Number(stageForm.expected_exit_code) ?? 0,
        success_criteria,
        docs_url: stageForm.docs_url || null,
        concepts_content: stageForm.concepts_content || null,
        estimated_minutes: Number(stageForm.estimated_minutes) || 30,
        verification_type: stageForm.verification_type as 'docker_test' | 'contract',
        acceptance_contract,
      });
    },
    onSuccess: async () => {
      toast.success('Stage added');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
      setStageForm((s) => ({
        ...s,
        title: '',
        description: '',
        instructions: '',
        code_example: '',
        hintsText: '',
        test_command: '',
        success_criteria_json: '{}',
      }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stageUpdateMutation = useMutation({
    mutationFn: () => {
      if (!editingStageId) throw new Error('No stage selected');
      let hints: string[] = [];
      hints = stageForm.hintsText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      let success_criteria: Record<string, unknown> = {};
      try {
        success_criteria = JSON.parse(stageForm.success_criteria_json || '{}');
      } catch {
        throw new Error('success_criteria must be valid JSON');
      }
      let acceptance_contract: Record<string, unknown> = {};
      try {
        acceptance_contract = JSON.parse(stageForm.acceptance_contract_json || '{}');
      } catch {
        throw new Error('acceptance_contract must be valid JSON');
      }
      return buildHavenAdminApi.updateStage(editingStageId, {
        stage_number: Number(stageForm.stage_number) || 1,
        title: stageForm.title,
        difficulty: stageForm.difficulty,
        description: stageForm.description || null,
        instructions: stageForm.instructions || null,
        code_example: stageForm.code_example || null,
        hints,
        test_command: stageForm.test_command || null,
        docker_test_image: stageForm.docker_test_image || null,
        timeout_seconds: Number(stageForm.timeout_seconds) || 120,
        expected_exit_code: Number(stageForm.expected_exit_code) ?? 0,
        success_criteria,
        docs_url: stageForm.docs_url || null,
        concepts_content: stageForm.concepts_content || null,
        estimated_minutes: Number(stageForm.estimated_minutes) || 30,
        verification_type: stageForm.verification_type as 'docker_test' | 'contract',
        acceptance_contract,
      });
    },
    onSuccess: async () => {
      toast.success('Stage updated');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
      setEditingStageId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stageDeleteMutation = useMutation({
    mutationFn: (id: string) => buildHavenAdminApi.deleteStage(id),
    onSuccess: async () => {
      toast.success('Stage removed');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (order: { id: string; sort_order: number }[]) => buildHavenAdminApi.reorderStages(selectedId, order),
    onSuccess: async () => {
      toast.success('Order saved');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const languageMutation = useMutation({
    mutationFn: () => {
      const existing = (detailQuery.data?.languages || []).find((lang: any) => lang.id === editingLanguageId);
      if (editingLanguageId && existing) {
        return buildHavenAdminApi.updateLanguage(editingLanguageId, languageForm);
      }
      return buildHavenAdminApi.upsertLanguage(selectedId, languageForm);
    },
    onSuccess: async () => {
      toast.success('Language saved');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
      setEditingLanguageId(null);
      setLanguageForm({
        language: '',
        starter_repo_url: '',
        docker_test_image: '',
        setup_instructions: '',
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLanguageMutation = useMutation({
    mutationFn: (payload: { id: string; language: string }) =>
      payload.id
        ? buildHavenAdminApi.deleteLanguageById(payload.id)
        : buildHavenAdminApi.deleteLanguage(selectedId, payload.language),
    onSuccess: async () => {
      toast.success('Language removed');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenge', selectedId] });
      if (editingLanguageId) {
        setEditingLanguageId(null);
        setLanguageForm({
          language: '',
          starter_repo_url: '',
          docker_test_image: '',
          setup_instructions: '',
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedChallengeIds, setSelectedChallengeIds] = useState<string[]>([]);

  const archiveMutation = useMutation({
    mutationFn: (id: string) => buildHavenAdminApi.deleteChallenge(id),
    onSuccess: async () => {
      toast.success('Challenge archived');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenges'] });
      setSelectedId('');
      setTab('overview');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => buildHavenAdminApi.hardDeleteChallenge(id),
    onSuccess: async () => {
      toast.success('Challenge permanently deleted');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenges'] });
      setSelectedId('');
      setTab('overview');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: ({ ids, permanent }: { ids: string[]; permanent: boolean }) =>
      buildHavenAdminApi.bulkDeleteChallenges(ids, permanent),
    onSuccess: async (data: any) => {
      toast.success(data?.message || 'Bulk operation completed');
      await qc.invalidateQueries({ queryKey: ['admin-build-challenges'] });
      setSelectedChallengeIds([]);
      setSelectedId('');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stageItems.findIndex((s) => s.id === active.id);
    const newIndex = stageItems.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(stageItems, oldIndex, newIndex);
    setStageItems(next);
    const order = next.map((row, idx) => ({ id: row.id, sort_order: idx + 1 }));
    reorderMutation.mutate(order);
  };

  const beginEditStage = (stage: any) => {
    setEditingStageId(stage.id);
    const hintsArr = Array.isArray(stage.hints) ? stage.hints : [];
    setStageForm({
      stage_number: stage.stage_number,
      title: stage.title || '',
      difficulty: stage.difficulty || 'medium',
      description: stage.description || '',
      instructions: stage.instructions || '',
      code_example: stage.code_example || '',
      hintsText: hintsArr.join('\n'),
      test_command: stage.test_command || '',
      docker_test_image: stage.docker_test_image || '',
      timeout_seconds: stage.timeout_seconds ?? 120,
      expected_exit_code: stage.expected_exit_code ?? 0,
      success_criteria_json: JSON.stringify(stage.success_criteria || {}, null, 2),
      docs_url: stage.docs_url || '',
      concepts_content: stage.concepts_content || '',
      estimated_minutes: stage.estimated_minutes ?? 30,
      verification_type: stage.verification_type || 'docker_test',
      acceptance_contract_json: JSON.stringify(stage.acceptance_contract || {}, null, 2),
    });
    setTab('stages');
  };

  const previewChallenge = useMemo(() => detailQuery.data?.challenge, [detailQuery.data]);

  const tabBtn = (key: TabKey, label: string) => (
    <button
      type="button"
      key={key}
      onClick={() => setTab(key)}
      className={`rounded-md px-3 py-1.5 text-sm font-medium ${
        tab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  // Populate form when a challenge is selected
  const populateForm = (challenge: any) => {
    setForm({
      title: challenge.title || '',
      slug: challenge.slug || '',
      description: challenge.description || '',
      short_tagline: challenge.short_tagline || '',
      thumbnail_url: challenge.thumbnail_url || '',
      difficulty_level: challenge.difficulty_level || 'beginner',
      status: challenge.status || 'draft',
      is_free: Boolean(challenge.is_free),
      supported_languages: (challenge.supported_languages || []).join(','),
      what_you_build: challenge.what_you_build || '',
      what_you_learn: challenge.what_you_learn || '',
      why_build: challenge.why_build || '',
      prerequisites_content: challenge.prerequisites_content || '',
      duration_days: challenge.duration_days ?? 30,
      price_inr: challenge.price_inr ?? 0,
      available_modes: challenge.available_modes || ['traditional'],
      default_mode: challenge.default_mode || 'traditional',
      reference_demo_url: challenge.reference_demo_url || '',
      product_contract: challenge.product_contract || '',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build challenges</h1>
        <p className="text-sm text-muted-foreground">Fully SaaS-configurable CodeCrafters-style tracks.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Programs</CardTitle>
              {filteredChallenges.length > 0 && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded"
                    checked={
                      selectedChallengeIds.length > 0 &&
                      selectedChallengeIds.length === filteredChallenges.length
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChallengeIds(filteredChallenges.map((c: any) => c.id));
                      } else {
                        setSelectedChallengeIds([]);
                      }
                    }}
                  />
                  Select All
                </label>
              )}
            </div>
            <select
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setSelectedChallengeIds([]);
              }}
            >
              <option value="all">All (except archived)</option>
              <option value="active">Active</option>
              <option value="live">Live</option>
              <option value="beta">Beta</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            {selectedChallengeIds.length > 0 && (
              <div className="mt-3 p-2 rounded-lg border bg-amber-500/10 border-amber-500/30 space-y-2">
                <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  {selectedChallengeIds.length} selected
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs justify-start"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={() => {
                      if (confirm(`Archive ${selectedChallengeIds.length} selected challenge(s)?`)) {
                        bulkDeleteMutation.mutate({ ids: selectedChallengeIds, permanent: false });
                      }
                    }}
                  >
                    Archive Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs justify-start"
                    disabled={bulkDeleteMutation.isPending}
                    onClick={() => {
                      if (
                        confirm(
                          `PERMANENTLY DELETE ${selectedChallengeIds.length} selected challenge(s)? This cannot be undone!`
                        )
                      ) {
                        bulkDeleteMutation.mutate({ ids: selectedChallengeIds, permanent: true });
                      }
                    }}
                  >
                    <Trash2 className="mr-1.5 h-3 w-3" />
                    Delete Permanently
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {(filteredChallenges || []).map((challenge: any) => {
              const isSelected = selectedChallengeIds.includes(challenge.id);
              const isArchived = challenge.status === 'archived';
              return (
                <div key={challenge.id} className="group relative flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded shrink-0 cursor-pointer"
                    checked={isSelected}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedChallengeIds((prev) => [...prev, challenge.id]);
                      } else {
                        setSelectedChallengeIds((prev) => prev.filter((id) => id !== challenge.id));
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(challenge.id);
                      populateForm(challenge);
                      setTab('overview');
                      setEditingStageId(null);
                    }}
                    className={`w-full min-w-0 rounded-lg border p-2.5 text-left transition-colors ${
                      selectedId === challenge.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <div className="font-medium text-sm truncate">{challenge.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span>{challenge.slug}</span>
                      <span>•</span>
                      <Badge variant={isArchived ? 'destructive' : 'secondary'} className="text-[10px] px-1 py-0 capitalize">
                        {challenge.status}
                      </Badge>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={isArchived ? 'Permanently Delete' : 'Archive / Delete'}
                    onClick={() => {
                      if (isArchived) {
                        if (confirm(`PERMANENTLY DELETE challenge "${challenge.title}"? This cannot be undone!`)) {
                          hardDeleteMutation.mutate(challenge.id);
                        }
                      } else {
                        if (confirm(`Archive challenge "${challenge.title}"? (You can permanently delete it from the Archived tab)`)) {
                          archiveMutation.mutate(challenge.id);
                        }
                      }
                    }}
                  >
                    <Trash2 className={`h-4 w-4 ${isArchived ? 'text-destructive' : 'text-muted-foreground hover:text-destructive'}`} />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 rounded-lg border bg-card/40 p-2">
            {tabBtn('overview', 'Overview')}
            {tabBtn('stages', 'Stages')}
            {tabBtn('languages', 'Languages')}
            {tabBtn('vibe_config', '⚡ Vibe Config')}
            {tabBtn('preview', 'Preview')}
            {tabBtn('analytics', 'Analytics')}
          </div>

          {tab === 'overview' ? (
            <Card>
              <CardHeader>
                <CardTitle>{selectedId ? 'Challenge overview' : 'Create challenge'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input placeholder="Title" value={form.title} onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))} />
                <Input placeholder="Slug" value={form.slug} onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))} />
                <Input
                  placeholder="Short tagline"
                  value={form.short_tagline}
                  onChange={(e) => setForm((s) => ({ ...s, short_tagline: e.target.value }))}
                />
                <Input
                  placeholder="Thumbnail URL"
                  value={form.thumbnail_url}
                  onChange={(e) => setForm((s) => ({ ...s, thumbnail_url: e.target.value }))}
                />
                <Textarea
                  placeholder="Description"
                  value={form.description}
                  onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                />
                <Textarea
                  placeholder="What will I build? (markdown)"
                  value={form.what_you_build}
                  onChange={(e) => setForm((s) => ({ ...s, what_you_build: e.target.value }))}
                />
                <Textarea
                  placeholder="What will I learn? (markdown)"
                  value={form.what_you_learn}
                  onChange={(e) => setForm((s) => ({ ...s, what_you_learn: e.target.value }))}
                />
                <Textarea
                  placeholder="Why build this? (markdown)"
                  value={form.why_build}
                  onChange={(e) => setForm((s) => ({ ...s, why_build: e.target.value }))}
                />
                <Textarea
                  placeholder="Prerequisites (markdown)"
                  value={form.prerequisites_content}
                  onChange={(e) => setForm((s) => ({ ...s, prerequisites_content: e.target.value }))}
                />
                <Input
                  placeholder="Supported languages (comma separated)"
                  value={form.supported_languages}
                  onChange={(e) => setForm((s) => ({ ...s, supported_languages: e.target.value }))}
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <Input
                    placeholder="Duration (days)"
                    type="number"
                    value={form.duration_days}
                    onChange={(e) => setForm((s) => ({ ...s, duration_days: Number(e.target.value) }))}
                  />
                  <Input
                    placeholder="Price (INR minor units)"
                    type="number"
                    value={form.price_inr}
                    onChange={(e) => setForm((s) => ({ ...s, price_inr: Number(e.target.value) }))}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_free}
                      onChange={(e) => setForm((s) => ({ ...s, is_free: e.target.checked }))}
                    />
                    Free in beta
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.difficulty_level}
                    onChange={(e) => setForm((s) => ({ ...s, difficulty_level: e.target.value }))}
                  >
                    <option value="beginner">beginner</option>
                    <option value="intermediate">intermediate</option>
                    <option value="advanced">advanced</option>
                  </select>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.status}
                    onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  >
                    <option value="draft">draft</option>
                    <option value="beta">beta</option>
                    <option value="live">live</option>
                    <option value="active">active (legacy)</option>
                    <option value="archived">archived</option>
                  </select>
                </div>

                {/* ── Available Build Modes ──────────────────────── */}
                <div className="rounded-lg border bg-card/60 p-4 space-y-3">
                  <p className="text-sm font-semibold">Available Build Modes</p>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={form.available_modes.includes('traditional')}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            available_modes: e.target.checked
                              ? [...new Set([...s.available_modes, 'traditional'])]
                              : s.available_modes.filter((m) => m !== 'traditional'),
                          }))
                        }
                      />
                      🛠 Traditional
                      <span className="text-xs text-muted-foreground">(GitHub + Docker tests)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded"
                        checked={form.available_modes.includes('vibe')}
                        onChange={(e) =>
                          setForm((s) => ({
                            ...s,
                            available_modes: e.target.checked
                              ? [...new Set([...s.available_modes, 'vibe'])]
                              : s.available_modes.filter((m) => m !== 'vibe'),
                          }))
                        }
                      />
                      ⚡ Vibe Coded
                      <span className="text-xs text-muted-foreground">(AI tools + proof gates)</span>
                    </label>
                  </div>
                  {form.available_modes.length > 1 && (
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-muted-foreground shrink-0">Default mode:</p>
                      <select
                        className="rounded-md border bg-background px-3 py-1.5 text-sm"
                        value={form.default_mode}
                        onChange={(e) => setForm((s) => ({ ...s, default_mode: e.target.value }))}
                      >
                        {form.available_modes.includes('traditional') && (
                          <option value="traditional">Traditional</option>
                        )}
                        {form.available_modes.includes('vibe') && (
                          <option value="vibe">Vibe Coded</option>
                        )}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                    Create
                  </Button>
                  <Button variant="outline" onClick={() => updateMutation.mutate()} disabled={!selectedId || updateMutation.isPending}>
                    Save overview
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'stages' && selectedId ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Reorder stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={stageItems.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {stageItems.map((stage) => (
                          <SortableStageRow
                            key={stage.id}
                            stage={stage}
                            onEdit={beginEditStage}
                            onDelete={(id) => {
                              if (confirm('Remove this stage?')) stageDeleteMutation.mutate(id);
                            }}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{editingStageId ? 'Edit stage' : 'Add stage'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      type="number"
                      placeholder="Stage number"
                      value={stageForm.stage_number}
                      onChange={(e) => setStageForm((s) => ({ ...s, stage_number: Number(e.target.value) || 1 }))}
                    />
                    <select
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                      value={stageForm.difficulty}
                      onChange={(e) => setStageForm((s) => ({ ...s, difficulty: e.target.value }))}
                    >
                      <option value="easy">easy</option>
                      <option value="medium">medium</option>
                      <option value="hard">hard</option>
                    </select>
                  </div>
                  <Input placeholder="Title" value={stageForm.title} onChange={(e) => setStageForm((s) => ({ ...s, title: e.target.value }))} />
                  <Textarea
                    placeholder="Description (markdown)"
                    value={stageForm.description}
                    onChange={(e) => setStageForm((s) => ({ ...s, description: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Instructions (markdown)"
                    value={stageForm.instructions}
                    onChange={(e) => setStageForm((s) => ({ ...s, instructions: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Code example (markdown; use ```diff for diffs)"
                    className="min-h-[140px]"
                    value={stageForm.code_example}
                    onChange={(e) => setStageForm((s) => ({ ...s, code_example: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Hints (one per line)"
                    value={stageForm.hintsText}
                    onChange={(e) => setStageForm((s) => ({ ...s, hintsText: e.target.value }))}
                  />
                  {/* ── Verification type ──────────────────────── */}
                  <div className="rounded-lg border bg-card/60 p-4 space-y-3">
                    <p className="text-sm font-semibold">Verification Type</p>
                    <div className="flex flex-wrap gap-6">
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="radio"
                          name="verification_type"
                          value="docker_test"
                          checked={stageForm.verification_type === 'docker_test'}
                          onChange={() => setStageForm((s) => ({ ...s, verification_type: 'docker_test' }))}
                        />
                        🛠 Docker Test
                        <span className="text-xs text-muted-foreground">(Traditional — run a command, check exit code)</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="radio"
                          name="verification_type"
                          value="contract"
                          checked={stageForm.verification_type === 'contract'}
                          onChange={() => setStageForm((s) => ({ ...s, verification_type: 'contract' }))}
                        />
                        ⚡ Acceptance Contract
                        <span className="text-xs text-muted-foreground">(Vibe — Playwright proof gates)</span>
                      </label>
                    </div>
                  </div>

                  {/* ── Traditional: docker fields ─────────────── */}
                  {stageForm.verification_type === 'docker_test' && (
                    <>
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          placeholder="test_command"
                          value={stageForm.test_command}
                          onChange={(e) => setStageForm((s) => ({ ...s, test_command: e.target.value }))}
                        />
                        <Input
                          placeholder="docker_test_image (optional override)"
                          value={stageForm.docker_test_image}
                          onChange={(e) => setStageForm((s) => ({ ...s, docker_test_image: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-3">
                        <Input
                          type="number"
                          placeholder="timeout_seconds"
                          value={stageForm.timeout_seconds}
                          onChange={(e) => setStageForm((s) => ({ ...s, timeout_seconds: Number(e.target.value) || 120 }))}
                        />
                        <Input
                          type="number"
                          placeholder="expected_exit_code"
                          value={stageForm.expected_exit_code}
                          onChange={(e) => setStageForm((s) => ({ ...s, expected_exit_code: Number(e.target.value) }))}
                        />
                        <Input
                          type="number"
                          placeholder="estimated_minutes"
                          value={stageForm.estimated_minutes}
                          onChange={(e) => setStageForm((s) => ({ ...s, estimated_minutes: Number(e.target.value) || 30 }))}
                        />
                      </div>
                      <Textarea
                        placeholder='{"output_contains":"PASS","next_hint_on_fail":"Try X"}'
                        className="min-h-[100px] font-mono text-xs"
                        value={stageForm.success_criteria_json}
                        onChange={(e) => setStageForm((s) => ({ ...s, success_criteria_json: e.target.value }))}
                      />
                    </>
                  )}

                  {/* ── Vibe: acceptance contract ─────────────── */}
                  {stageForm.verification_type === 'contract' && (
                    <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-1">⚡ Acceptance Contract JSON</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Define proof gates as journeys. Each journey has steps the Playwright runner will execute.
                          Set <code className="font-mono bg-muted px-1 rounded">public: true</code> to show the journey to learners;
                          add <code className="font-mono bg-muted px-1 rounded">admin_only: true</code> per step to hide specific assertions.
                        </p>
                        <Textarea
                          className="min-h-[240px] font-mono text-xs"
                          placeholder={`{
  "journeys": [
    {
      "id": "create_task",
      "label": "User can create a task",
      "public": true,
      "steps": [
        { "action": "goto", "target": "/" },
        { "action": "click", "target": "Add Task" },
        { "action": "fill", "target": "Task title", "value": "Learn Spring Boot" },
        { "action": "click", "target": "Save" },
        { "action": "expect_visible", "target": "Learn Spring Boot" }
      ]
    }
  ],
  "api_checks": [],
  "visual_checks": []
}`}
                          value={stageForm.acceptance_contract_json}
                          onChange={(e) => setStageForm((s) => ({ ...s, acceptance_contract_json: e.target.value }))}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p className="font-semibold text-violet-600 dark:text-violet-400">Supported actions:</p>
                        <p><code className="font-mono bg-muted px-1 rounded">goto</code> · <code className="font-mono bg-muted px-1 rounded">click</code> · <code className="font-mono bg-muted px-1 rounded">fill</code> · <code className="font-mono bg-muted px-1 rounded">expect_visible</code> · <code className="font-mono bg-muted px-1 rounded">expect_hidden</code> · <code className="font-mono bg-muted px-1 rounded">reload</code> · <code className="font-mono bg-muted px-1 rounded">wait</code> · <code className="font-mono bg-muted px-1 rounded">screenshot</code></p>
                      </div>
                    </div>
                  )}

                  <Input
                    placeholder="docs_url (optional external link)"
                    value={stageForm.docs_url}
                    onChange={(e) => setStageForm((s) => ({ ...s, docs_url: e.target.value }))}
                  />
                  <Textarea
                    placeholder="Concepts tab content (markdown tutorials for this stage)"
                    className="min-h-[120px]"
                    value={stageForm.concepts_content}
                    onChange={(e) => setStageForm((s) => ({ ...s, concepts_content: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    {editingStageId ? (
                      <>
                        <Button onClick={() => stageUpdateMutation.mutate()} disabled={stageUpdateMutation.isPending}>
                          Save stage
                        </Button>
                        <Button variant="ghost" onClick={() => setEditingStageId(null)}>
                          Cancel edit
                        </Button>
                      </>
                    ) : (
                      <Button onClick={() => stageCreateMutation.mutate()} disabled={stageCreateMutation.isPending}>
                        Add stage
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {tab === 'languages' && selectedId ? (
            <Card>
              <CardHeader>
                <CardTitle>Starter templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="language key (python, nodejs, java — one per row)"
                  value={languageForm.language}
                  onChange={(e) => setLanguageForm((s) => ({ ...s, language: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Use a single language key per entry (no commas). The GitHub template repo must exist and have
                  &quot;Template repository&quot; enabled in GitHub Settings.
                </p>
                <Input
                  placeholder="GitHub template repo URL (https://github.com/owner/repo)"
                  value={languageForm.starter_repo_url}
                  onChange={(e) => setLanguageForm((s) => ({ ...s, starter_repo_url: e.target.value }))}
                />
                <Input
                  placeholder="docker_test_image"
                  value={languageForm.docker_test_image}
                  onChange={(e) => setLanguageForm((s) => ({ ...s, docker_test_image: e.target.value }))}
                />
                <Textarea
                  placeholder="setup_instructions (markdown)"
                  value={languageForm.setup_instructions}
                  onChange={(e) => setLanguageForm((s) => ({ ...s, setup_instructions: e.target.value }))}
                />
                <Button onClick={() => languageMutation.mutate()} disabled={languageMutation.isPending}>
                  {editingLanguageId ? 'Update language' : 'Save language'}
                </Button>

                <div className="pt-4">
                  <p className="text-sm font-medium">Configured</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(detailQuery.data?.languages || []).map((l: any) => (
                      <div key={l.id} className="flex items-center gap-1 rounded-md border bg-secondary/30 pl-3 pr-1 py-1 text-sm">
                        <span className="font-medium mr-2">{l.language}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setEditingLanguageId(l.id);
                            setLanguageForm({
                              language: l.language,
                              starter_repo_url: l.starter_repo_url || '',
                              docker_test_image: l.docker_test_image || '',
                              setup_instructions: l.setup_instructions || '',
                            });
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Remove language ${l.language}?`)) {
                              deleteLanguageMutation.mutate({ id: l.id, language: l.language });
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'preview' && previewChallenge ? (
            <Card>
              <CardHeader>
                <CardTitle>Student preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold">{previewChallenge.title}</h3>
                  <p className="text-sm text-muted-foreground">{previewChallenge.short_tagline}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-semibold">What will I build?</h4>
                    <MarkdownPreview content={previewChallenge.what_you_build || '_Empty_'} />
                  </div>
                  <div>
                    <h4 className="font-semibold">What will I learn?</h4>
                    <MarkdownPreview content={previewChallenge.what_you_learn || '_Empty_'} />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Stages</h4>
                  <div className="mt-2 space-y-2">
                    {(detailQuery.data?.stages || [])
                      .filter((s: any) => s.is_active)
                      .sort((a: any, b: any) => a.stage_number - b.stage_number)
                      .map((s: any) => (
                        <div key={s.id} className="rounded-md border p-2 text-sm">
                          <div className="font-medium">
                            #{s.stage_number} {s.title}
                          </div>
                          <MarkdownPreview content={s.description || ''} />
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'vibe_config' && selectedId ? (
            <Card>
              <CardHeader>
                <CardTitle>⚡ Vibe Coding Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Reference / Golden Demo URL</p>
                  <p className="text-xs text-muted-foreground mb-2">Live URL of your canonical reference build that learners can view before submitting.</p>
                  <Input
                    placeholder="https://demo.yourdomain.com/task-manager"
                    value={form.reference_demo_url}
                    onChange={(e) => setForm((s) => ({ ...s, reference_demo_url: e.target.value }))}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">Product Contract (markdown)</p>
                  <p className="text-xs text-muted-foreground mb-2">Public spec shown to vibe learners. Tell them WHAT must work, not HOW to build it.</p>
                  <Textarea
                    className="min-h-[200px] font-mono text-xs"
                    placeholder={`## Your app must allow a user to:\n\n1. Create a task\n2. Edit a task\n3. Complete a task\n4. Delete a task\n5. Tasks must persist after page refresh`}
                    value={form.product_contract}
                    onChange={(e) => setForm((s) => ({ ...s, product_contract: e.target.value }))}
                  />
                </div>
                <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-violet-600 dark:text-violet-400 mb-1">⚡ Vibe Mode — How it works</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Learner reads the Product Contract and builds using any tool (Claude, Cursor, Lovable, etc.)</li>
                    <li>Learner submits a GitHub repo URL or live deployment URL</li>
                    <li>Platform runs Playwright journeys (from contract-type stages) to verify the product works</li>
                    <li>Result shown as per-gate pass/fail with evidence</li>
                    <li>Premium: "Fix with AI" available to paid users only</li>
                  </ul>
                </div>
                <Button onClick={() => updateMutation.mutate()} disabled={!selectedId || updateMutation.isPending}>
                  Save Vibe Config
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {tab === 'analytics' && selectedId && analyticsQuery.data ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsQuery.data.analytics.summary.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsQuery.data.analytics.summary.completionRate}%</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Active This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{analyticsQuery.data.analytics.summary.activeThisWeek}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Stage Funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b text-muted-foreground">
                        <tr>
                          <th className="pb-2 font-medium">Stage</th>
                          <th className="pb-2 font-medium">Title</th>
                          <th className="pb-2 font-medium">Attempts</th>
                          <th className="pb-2 font-medium">Pass Rate</th>
                          <th className="pb-2 font-medium">Avg Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {analyticsQuery.data.analytics.stageStats.map((s: any) => (
                          <tr key={s.stage_number}>
                            <td className="py-2">#{s.stage_number}</td>
                            <td className="py-2">{s.title}</td>
                            <td className="py-2">{s.attempts}</td>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className="h-full bg-primary"
                                    style={{ width: `${s.pass_rate}%` }}
                                  />
                                </div>
                                <span className="text-xs">{s.pass_rate}%</span>
                              </div>
                            </td>
                            <td className="py-2">{Math.round(s.avg_time_ms / 1000)}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Enrollments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analyticsQuery.data.analytics.enrollments.slice(0, 10).map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <div className="font-medium text-sm">{e.user_id}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px]">{e.language}</Badge>
                            <span className="text-xs text-muted-foreground">Stage {e.current_stage} ({e.progress_percentage}%)</span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {e.last_push_at ? new Date(e.last_push_at).toLocaleDateString() : 'No pushes'}
                          <div className="mt-1 capitalize">{e.status.replace('_', ' ')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {!selectedId && tab !== 'overview' ? (
            <p className="text-sm text-muted-foreground">Select or create a challenge to manage stages, languages, and preview.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
