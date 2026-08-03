import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { commerceAdminService, type AdminCoupon } from '../../services/commerce.admin.service';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, Loader2, Save, X, Ticket, Copy, Check, Code, Eye, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

type FormMode = 'visual' | 'json';

const EMPTY_FORM = {
  code: '', discount_percent: '', discount_fixed: '',
  min_amount: '', max_discount: '', max_uses: '',
  valid_from: '', valid_until: '', is_active: true,
};

const CouponsPage = () => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('visual');
  const [form, setForm] = useState(EMPTY_FORM);
  const [jsonRaw, setJsonRaw] = useState('{}');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: commerceAdminService.listCoupons,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => commerceAdminService.createCoupon(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon created');
      closeForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => commerceAdminService.updateCoupon(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon updated');
      closeForm();
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => commerceAdminService.deleteCoupon(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      toast.success('Coupon deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || e.message),
  });

  const closeForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (c: AdminCoupon) => {
    setEditingId(c.id);
    setShowCreate(false);
    setForm({
      code: c.code, discount_percent: String(c.discount_percent || ''),
      discount_fixed: String(c.discount_fixed || ''), min_amount: String(c.min_amount || ''),
      max_discount: String(c.max_discount || ''), max_uses: String(c.max_uses || ''),
      valid_from: c.valid_from ? c.valid_from.split('T')[0] : '',
      valid_until: c.valid_until ? c.valid_until.split('T')[0] : '',
      is_active: c.is_active,
    });
    setJsonRaw(JSON.stringify(c, null, 2));
  };

  const buildPayload = () => {
    if (formMode === 'json') {
      try { return JSON.parse(jsonRaw); } catch { toast.error('Invalid JSON'); return null; }
    }
    return {
      code: form.code.toUpperCase().trim(),
      discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : undefined,
      discount_fixed: form.discount_fixed ? parseFloat(form.discount_fixed) : undefined,
      min_amount: form.min_amount ? parseFloat(form.min_amount) : undefined,
      max_discount: form.max_discount ? parseFloat(form.max_discount) : undefined,
      max_uses: form.max_uses ? parseInt(form.max_uses) : undefined,
      valid_from: form.valid_from || undefined,
      valid_until: form.valid_until || undefined,
      is_active: form.is_active,
    };
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (!payload) return;
    if (editingId) { updateMut.mutate({ id: editingId, data: payload }); }
    else { createMut.mutate(payload); }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const code = 'DSA' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setForm({ ...form, code });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const couponsList = Array.isArray(coupons) ? coupons : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Coupon Manager</h2>
          <p className="text-muted-foreground mt-1">Create and manage discount coupons</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setEditingId(null); setForm(EMPTY_FORM); setFormMode('visual'); }}>
          <Plus className="mr-2 h-4 w-4" /> New Coupon
        </Button>
      </div>

      {/* Coupon Editor */}
      {(showCreate || editingId) && (
        <Card className="border-0 shadow-lg animate-scale-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="w-4 h-4 text-primary" />
              {editingId ? 'Edit Coupon' : 'Create Coupon'}
            </CardTitle>
            <div className="flex items-center gap-1 bg-accent rounded-lg p-0.5">
              <button
                onClick={() => setFormMode('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formMode === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Eye className="w-3 h-3" /> Visual
              </button>
              <button
                onClick={() => { setFormMode('json'); setJsonRaw(JSON.stringify(buildPayload(), null, 2)); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  formMode === 'json' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                <Code className="w-3 h-3" /> JSON
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {formMode === 'visual' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Coupon Code</Label>
                    <div className="flex gap-2">
                      <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="DSAPRO50" className="flex-1 font-mono" />
                      <Button variant="outline" size="sm" onClick={generateCode} className="text-xs">Generate</Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-6">
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Discount %</Label>
                    <Input type="number" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} placeholder="20" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fixed Discount (₹)</Label>
                    <Input type="number" value={form.discount_fixed} onChange={(e) => setForm({ ...form, discount_fixed: e.target.value })} placeholder="100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Min Order (₹)</Label>
                    <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: e.target.value })} placeholder="499" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Discount (₹)</Label>
                    <Input type="number" value={form.max_discount} onChange={(e) => setForm({ ...form, max_discount: e.target.value })} placeholder="200" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Max Uses</Label>
                    <Input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="100" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valid From</Label>
                    <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Valid Until</Label>
                    <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Advanced — edit raw JSON</p>
                <Textarea value={jsonRaw} onChange={(e) => setJsonRaw(e.target.value)} className="font-mono text-xs min-h-[200px] bg-accent/30" spellCheck={false} />
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t">
              <Button size="sm" disabled={createMut.isPending || updateMut.isPending} onClick={handleSave}>
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                <Save className="mr-1 h-3 w-3" /> {editingId ? 'Update' : 'Create'}
              </Button>
              <Button size="sm" variant="outline" onClick={closeForm}>
                <X className="mr-1 h-3 w-3" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupons Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Uses</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : !couponsList.length ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <Ticket className="mx-auto h-8 w-8 mb-2 opacity-30" />
                  No coupons created
                </TableCell></TableRow>
              ) : (
                couponsList.map((c: any) => {
                  const expired = c.valid_until && new Date(c.valid_until) < new Date();
                  return (
                    <TableRow key={c.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold bg-accent px-2 py-0.5 rounded">{c.code}</code>
                          <button onClick={() => copyCode(c.code)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                            {copiedId === c.code ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {c.discount_percent ? `${c.discount_percent}%` : c.discount_fixed ? `₹${c.discount_fixed}` : '—'}
                        </span>
                        {c.max_discount && <span className="text-xs text-muted-foreground ml-1">(max ₹{c.max_discount})</span>}
                      </TableCell>
                      <TableCell className="tabular-nums">{c.used_count || 0}{c.max_uses ? `/${c.max_uses}` : ''}</TableCell>
                      <TableCell className="text-xs">{c.valid_until ? new Date(c.valid_until).toLocaleDateString() : 'No expiry'}</TableCell>
                      <TableCell>
                        <Badge variant={expired ? 'destructive' : c.is_active ? 'default' : 'secondary'}>
                          {expired ? 'Expired' : c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm('Delete this coupon?')) deleteMut.mutate(c.id); }}
                          ><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CouponsPage;
