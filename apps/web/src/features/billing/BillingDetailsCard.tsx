import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchBillingProfile, saveBillingProfile, GST_STATES, type BillingProfile } from './billing.service';

const EMPTY: BillingProfile = { legal_name: null, gstin: null, state_code: null, address: null };

/** Name, state and GSTIN printed on future invoices (a business GSTIN lets you claim input tax credit). */
export function BillingDetailsCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['billing-profile'], queryFn: fetchBillingProfile, retry: false });
  const [form, setForm] = useState<BillingProfile>(EMPTY);
  useEffect(() => { if (data) setForm(data); }, [data]);
  const save = useMutation({
    mutationFn: () => saveBillingProfile(form),
    onSuccess: (p) => { qc.setQueryData(['billing-profile'], p); setForm(p); toast.success('Billing details saved — they appear on your next invoices'); },
    onError: (e: Error) => toast.error(e.message || 'Could not save your billing details'),
  });
  const set = (k: keyof BillingProfile) => (v: string) => setForm((f) => ({ ...f, [k]: v || null }));

  return (
    <section aria-labelledby="billing-details-heading" className="card-glass rounded-2xl p-5 border border-border/40">
      <h3 id="billing-details-heading" className="text-sm font-display font-bold text-foreground mb-1 flex items-center gap-2">
        <Building2 className="w-4 h-4 text-primary" aria-hidden /> Billing details
      </h3>
      <p className="text-xs text-muted-foreground mb-4">Printed on your GST invoices. Add your GSTIN if you're buying for a business.</p>
      <form className="grid sm:grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5">
          <Label htmlFor="bill-name">Name on invoice</Label>
          <Input id="bill-name" maxLength={120} value={form.legal_name ?? ''} onChange={(e) => set('legal_name')(e.target.value)} placeholder="Your name or company" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-state">State</Label>
          <select id="bill-state" value={form.state_code ?? ''} onChange={(e) => set('state_code')(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select your state</option>
            {GST_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-gstin">GSTIN (optional)</Label>
          <Input id="bill-gstin" maxLength={15} value={form.gstin ?? ''} onChange={(e) => set('gstin')(e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-address">Address (optional)</Label>
          <Input id="bill-address" maxLength={300} value={form.address ?? ''} onChange={(e) => set('address')(e.target.value)} placeholder="City, PIN" />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save billing details'}</Button>
        </div>
      </form>
    </section>
  );
}
