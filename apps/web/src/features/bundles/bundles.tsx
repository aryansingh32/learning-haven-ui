import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Package, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api.svc';
import { Button } from '@/components/ui/button';

export interface BundleCourse { id: string; title: string; slug: string; difficulty: string | null; price: number | null; chapters: number; owned: boolean }
export interface Bundle {
  id: string; slug: string; title: string; description: string | null; coverImage: string | null; price: number; currency: string;
  courses: BundleCourse[]; separatelyPrice: number | null; ownedCount: number;
}

export const fetchBundles = (): Promise<Bundle[]> => api.get('/bundles');
export const fetchBundle = (slug: string): Promise<Bundle> => api.get(`/bundles/${encodeURIComponent(slug)}`);
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
const saving = (b: Bundle) => (b.separatelyPrice && b.separatelyPrice > b.price ? Math.round(100 - (b.price / b.separatelyPrice) * 100) : 0);

declare global { interface Window { Razorpay: any } }
function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.head.appendChild(s);
  });
}

/** Order → Razorpay → verify. Resolves once access is granted; rejects with "Payment cancelled" if closed. */
async function buyBundle(bundle: Bundle) {
  const order: any = (await api.post('/v2/payments/create-bundle-order', { bundle_id: bundle.id })) as any;
  const { razorpayOrderId, finalAmount, keyId } = order.data ?? order;
  const verify = (paymentId: string, signature: string) => api.post('/v2/payments/verify', {
    razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId || razorpayOrderId, razorpay_signature: signature || 'free',
  });
  if (String(razorpayOrderId).startsWith('free_')) return verify('', '');
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    new window.Razorpay({
      key: keyId, amount: finalAmount, currency: bundle.currency || 'INR', name: 'Forge', description: `Bundle: ${bundle.title}`,
      order_id: razorpayOrderId, theme: { color: '#7C3AED' },
      handler: (r: any) => verify(r.razorpay_payment_id, r.razorpay_signature).then(resolve, reject),
      modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
    }).open();
  });
}

function PriceLine({ b, large = false }: { b: Bundle; large?: boolean }) {
  return (
    <p className={cn('flex flex-wrap items-baseline gap-2', large ? 'text-2xl' : 'text-lg')}>
      <span className="font-display font-bold text-foreground">{rupees(b.price)}</span>
      {b.separatelyPrice != null && b.separatelyPrice > b.price && <span className="text-sm text-muted-foreground line-through">{rupees(b.separatelyPrice)}</span>}
      {saving(b) > 0 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">Save {saving(b)}%</span>}
      <span className="text-xs text-muted-foreground">+ GST</span>
    </p>
  );
}

/** Bundles on Learn, under the search. Nothing when there are none. */
export function BundlesStrip() {
  const { data } = useQuery({ queryKey: ['bundles'], queryFn: fetchBundles, staleTime: 5 * 60_000, retry: false });
  if (!data?.length) return null;
  return (
    <section aria-label="Course bundles" className="space-y-3">
      <h2 className="flex items-center gap-2 text-base font-bold text-foreground"><Package className="h-4 w-4 text-primary" />Bundles · learn more, pay less</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((b) => (
          <Link key={b.id} to={`/bundles/${b.slug}`} className="card-glass rounded-2xl border border-border/50 p-4 transition hover:border-primary/40">
            <h3 className="font-semibold text-foreground">{b.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{b.courses.length} courses · {b.courses.map((c) => c.title).slice(0, 3).join(', ')}{b.courses.length > 3 ? '…' : ''}</p>
            <div className="mt-3"><PriceLine b={b} /></div>
            {b.ownedCount === b.courses.length && <p className="mt-1 text-xs font-semibold text-success">You have all of these</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function BundlePage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: b, isLoading, error } = useQuery({ queryKey: ['bundle', slug], queryFn: () => fetchBundle(slug), retry: false });
  const [done, setDone] = useState(false);
  const buy = useMutation({
    mutationFn: () => buyBundle(b!),
    onSuccess: () => {
      setDone(true);
      toast.success(`Unlocked ${b!.courses.length} courses`);
      qc.invalidateQueries({ queryKey: ['bundle', slug] });
      qc.invalidateQueries({ queryKey: ['bundles'] });
      qc.invalidateQueries({ queryKey: ['entitlements'] });
      qc.invalidateQueries({ queryKey: ['my-course-enrollments'] });
    },
    onError: (e: any) => { if (e?.message !== 'Payment cancelled') toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || 'Payment failed'); },
  });

  if (isLoading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (error || !b) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="font-display text-xl font-bold">This bundle isn't available</h1>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/courses')}>Back to Learn</Button>
      </div>
    );
  }
  const allOwned = b.ownedCount === b.courses.length;
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link to="/courses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Learn</Link>
      <header className="card-glass space-y-3 rounded-2xl border border-border/40 p-6">
        {b.coverImage && <img src={b.coverImage} alt="" className="h-40 w-full rounded-xl object-cover" />}
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Bundle · {b.courses.length} courses</p>
        <h1 className="font-display text-2xl font-bold text-foreground">{b.title}</h1>
        {b.description && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{b.description}</p>}
        <PriceLine b={b} large />
        {allOwned || done ? (
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-success"><CheckCircle2 className="h-4 w-4" />You have every course in this bundle</p>
        ) : (
          <div className="space-y-1">
            <Button size="lg" onClick={() => buy.mutate()} disabled={buy.isPending}>
              {buy.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Buy the bundle
            </Button>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />One payment, lifetime access to every course. GST invoice included.
              {b.ownedCount > 0 && ` You already have ${b.ownedCount}; you keep those as they are.`}</p>
          </div>
        )}
      </header>
      <section aria-label="Courses in this bundle" className="space-y-2">
        <h2 className="font-semibold">What's inside</h2>
        <ol className="space-y-2">
          {b.courses.map((c, i) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/60 p-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{c.title}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><BookOpen className="h-3 w-3" />{c.chapters} chapters{c.difficulty ? ` · ${c.difficulty}` : ''}{c.price != null ? ` · ${rupees(c.price)} on its own` : ''}</p>
              </div>
              {(c.owned || done) ? <Button size="sm" variant="outline" onClick={() => navigate(`/course/${c.id}/chapters`)}>Open</Button> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
