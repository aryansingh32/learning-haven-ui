import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commerceAdminService, type AdminPlan } from '../services/commerce.admin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus, Pencil, Trash2, Loader2, Save, X, CreditCard, Star,
  Code, Eye, ChevronDown, ChevronUp, Crown, Zap, Check, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

type FormMode = 'visual' | 'json';

const EMPTY_FORM = {
  name: '', slug: '', description: '',
  price_monthly: '', price_annual: '', price_lifetime: '', price_one_time: '',
  sort_order: '0',
  is_highlighted: false, is_active: true,
  features: [''],
  entitlements: JSON.stringify([
    { feature_key: 'ai_queries_per_day', label: 'AI Queries per Day', entitlement_type: 'numeric_limit', numeric_value: 5 },
    { feature_key: 'all_courses_access', label: 'All Courses', entitlement_type: 'boolean', bool_value: false },
    { feature_key: 'project_access', label: 'Projects', entitlement_type: 'numeric_limit', numeric_value: 2 }
  ], null, 2),
};

const Plans = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('visual');
  const [form, setForm] = useState(EMPTY_FORM);
  const [jsonRaw, setJsonRaw] = useState('{}');
  const [jsonError, setJsonError] = useState('');

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: commerceAdminService.listPlans,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => commerceAdminService.createPlan(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Plan created');
      closeForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => commerceAdminService.updatePlan(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Plan updated');
      closeForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commerceAdminService.deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plans'] });
      toast.success('Plan deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const closeForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setJsonRaw('{}');
    setJsonError('');
  };

  const startEdit = (p: AdminPlan) => {
    setEditingId(p.id);
    setShowCreate(false);
    const f = {
      name: p.name || '',
      slug: p.slug || '',
      description: p.description || '',
      price_monthly: String((p.price_monthly || 0) / 100),
      price_annual: String((p.price_annual || 0) / 100),
      price_lifetime: p.price_lifetime ? String(p.price_lifetime / 100) : '',
      price_one_time: p.price_one_time ? String(p.price_one_time / 100) : '',
      sort_order: String(p.sort_order || 0),
      is_highlighted: !!p.is_highlighted,
      is_active: p.is_active !== false,
      features: Array.isArray(p.features) && p.features.length > 0 ? p.features : [''],
      entitlements: JSON.stringify(p.entitlements || [], null, 2),
    };
    setForm(f);
    setJsonRaw(JSON.stringify(p, null, 2));
  };

  const buildPayload = () => {
    if (formMode === 'json') {
      try {
        const parsed = JSON.parse(jsonRaw);
        setJsonError('');
        return parsed;
      } catch (e) {
        setJsonError('Invalid JSON');
        return null;
      }
    }
    try {
      const entitlements = JSON.parse(form.entitlements || '[]');
      setJsonError('');
      return {
        name: form.name,
        slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'),
        description: form.description,
        price_monthly: Math.round((parseFloat(form.price_monthly) || 0) * 100),
        price_annual: Math.round((parseFloat(form.price_annual) || 0) * 100),
        price_lifetime: form.price_lifetime ? Math.round((parseFloat(form.price_lifetime) || 0) * 100) : null,
        price_one_time: form.price_one_time ? Math.round((parseFloat(form.price_one_time) || 0) * 100) : null,
        sort_order: parseInt(form.sort_order) || 0,
        is_highlighted: form.is_highlighted,
        is_active: form.is_active,
        features: form.features.filter(f => f.trim()),
        entitlements: Array.isArray(entitlements) ? entitlements : [],
      };
    } catch (e) {
      setJsonError('Invalid access rules JSON');
      return null;
    }
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!payload) return;
    if (editingId) {
      updateMut.mutate({ id: editingId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const addFeature = () => setForm({ ...form, features: [...form.features, ''] });
  const removeFeature = (i: number) => setForm({ ...form, features: form.features.filter((_, idx) => idx !== i) });
  const updateFeature = (i: number, val: string) => {
    const updated = [...form.features];
    updated[i] = val;
    setForm({ ...form, features: updated });
  };
  const plansList = Array.isArray(plans) ? plans : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Subscription Plans</h2>
          <p className="text-muted-foreground mt-1">Manage pricing plans, features, and billing intervals</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm(EMPTY_FORM); setFormMode('visual'); }}>
          <Plus className="mr-2 h-4 w-4" /> New Plan
        </Button>
      </div>

      {/* Plan Editor */}
      {(showCreate || editingId) && (
        <Card className="border-0 shadow-lg animate-scale-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              {editingId ? 'Edit Plan' : 'Create New Plan'}
            </CardTitle>
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5">
              <button
                onClick={() => setFormMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formMode === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="w-3 h-3" /> Visual
              </button>
              <button
                onClick={() => {
                  setFormMode('json');
                  setJsonRaw(JSON.stringify(buildPayload(), null, 2));
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code className="w-3 h-3" /> JSON
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formMode === 'visual' ? (
              <>
                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Plan Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro Plan" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Slug</Label>
                    <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="pro" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monthly Price (₹)</Label>
                    <Input type="number" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} placeholder="99" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Annual Price (₹)</Label>
                    <Input type="number" value={form.price_annual} onChange={(e) => setForm({ ...form, price_annual: e.target.value })} placeholder="799" />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Lifetime Price (₹)</Label>
                    <Input type="number" value={form.price_lifetime} onChange={(e) => setForm({ ...form, price_lifetime: e.target.value })} placeholder="2999" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">One-time Price (₹)</Label>
                    <Input type="number" value={form.price_one_time} onChange={(e) => setForm({ ...form, price_one_time: e.target.value })} placeholder="499" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sort Order</Label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this plan unlocks" />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={form.is_highlighted} onCheckedChange={(v) => setForm({ ...form, is_highlighted: v })} />
                    <span className="text-sm font-medium">Highlight Badge</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>

                {/* Features — Visual List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">✅ Included Features</Label>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addFeature}>
                      <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                  </div>
                  {form.features.map((feat, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={feat}
                        onChange={(e) => updateFeature(i, e.target.value)}
                        placeholder={`Feature ${i + 1}`}
                        className="flex-1"
                      />
                      {form.features.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeFeature(i)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Access Rules JSON</Label>
                  <Textarea
                    value={form.entitlements}
                    onChange={(e) => { setForm({ ...form, entitlements: e.target.value }); setJsonError(''); }}
                    className="font-mono text-xs min-h-[220px] bg-accent/30"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use feature keys like ai_queries_per_day, all_courses_access, course_access, career_path_access, project_access, apprenticeship_access, certificates_access, resume_builder_access.
                  </p>
                  {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
                </div>
              </>
            ) : (
              /* JSON Mode */
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="w-3 h-3" />
                  Advanced mode — edit the raw plan JSON directly
                </div>
                <Textarea
                  value={jsonRaw}
                  onChange={(e) => { setJsonRaw(e.target.value); setJsonError(''); }}
                  className="font-mono text-xs min-h-[300px] bg-accent/30"
                  spellCheck={false}
                />
                {jsonError && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {jsonError}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" disabled={createMut.isPending || updateMut.isPending} onClick={handleSave}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                <Save className="mr-1 h-3 w-3" /> {editingId ? 'Update Plan' : 'Create Plan'}
              </Button>
              <Button size="sm" variant="outline" onClick={closeForm}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Pricing</TableHead>
                <TableHead>Access Rules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : !plansList.length ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  <CreditCard className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  No plans configured
                </TableCell></TableRow>
              ) : (
                plansList.map((p: any) => (
                  <TableRow key={p.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {p.is_highlighted && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.slug}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs tabular-nums">
                        <div>Monthly: ₹{((p.price_monthly || 0) / 100).toLocaleString('en-IN')}</div>
                        <div>Annual: ₹{((p.price_annual || 0) / 100).toLocaleString('en-IN')}</div>
                        {p.price_one_time ? <div>One-time: ₹{(p.price_one_time / 100).toLocaleString('en-IN')}</div> : null}
                        {p.price_lifetime ? <div>Lifetime: ₹{(p.price_lifetime / 100).toLocaleString('en-IN')}</div> : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {(p.entitlements || []).slice(0, 5).map((ent: any) => (
                          <Badge key={ent.id || ent.feature_key} variant="outline" className="text-xs">
                            {ent.label || ent.feature_key}
                          </Badge>
                        ))}
                        {(p.entitlements || []).length > 5 ? (
                          <Badge variant="secondary" className="text-xs">+{(p.entitlements || []).length - 5}</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active !== false ? 'default' : 'secondary'}>
                        {p.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { if (confirm('Delete this plan?')) deleteMut.mutate(p.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Plans;
