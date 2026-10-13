import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Check, CheckCircle2, Crown, Loader2, Lock, ShieldCheck, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api.svc';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { orderOf, payOrder } from './razorpay';

/**
 * Buying without leaving the page (Coursera-style): anywhere in the app,
 * `useCheckout().open(...)` shows what's on offer — this course for life, or a
 * plan that unlocks everything — takes payment in Razorpay's overlay, and leaves
 * the learner where they were, now unlocked.
 */

export interface CheckoutCourse { id: string; title: string; description?: string | null }
export interface CheckoutRequest {
  /** A course the learner hit a lock on: offered on its own (when sold alone) next to the plans. */
  course?: CheckoutCourse;
  /** Why the dialog opened, shown as the subtitle ("Daily AI limit reached", …). */
  reason?: string;
  /** Called once access is granted. */
  onUnlocked?: () => void;
}

interface Plan {
  id: string; slug: string; name: string; tagline?: string | null; description?: string | null;
  price_monthly?: number | null; price_annual?: number | null; is_highlighted?: boolean;
  features_copy?: unknown; courses?: { title: string }[];
}
interface CourseDetail { id: string; title: string; description?: string | null; price?: number | null; currency?: string | null; is_individually_purchasable?: boolean }
type Choice = { kind: 'course' } | { kind: 'plan'; planId: string };
type Cycle = 'monthly' | 'annual';

const Ctx = createContext<{ open: (r?: CheckoutRequest) => void } | null>(null);

/** Opens the in-app checkout. Falls back to the pricing page outside the provider. */
export function useCheckout() {
  const ctx = useContext(Ctx);
  const navigate = useNavigate();
  return ctx ?? { open: () => navigate('/pricing') };
}

const rupees = (paise?: number | null) => `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const asList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CheckoutRequest | null>(null);
  const open = useCallback((r: CheckoutRequest = {}) => setRequest(r), []);
  const value = useMemo(() => ({ open }), [open]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <CheckoutDialog request={request} onClose={() => setRequest(null)} />
    </Ctx.Provider>
  );
}

function CheckoutDialog({ request, onClose }: { request: CheckoutRequest | null; onClose: () => void }) {
  const isOpen = request !== null;
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [cycle, setCycle] = useState<Cycle>('annual');
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<{ code: string; discount: number | null; message: string } | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [paying, setPaying] = useState(false);
  // Razorpay's window sits on the page; our dialog steps aside while it's open
  // (a modal dialog would block clicks and typing in it).
  const [inGateway, setInGateway] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const plansQuery = useQuery({
    queryKey: ['pricing-plans-live'],
    queryFn: async () => {
      const res = (await api.get('/plans')) as unknown;
      return (Array.isArray(res) ? res : (res as { data?: Plan[] })?.data ?? []) as Plan[];
    },
    enabled: isOpen,
    staleTime: 5 * 60_000,
  });
  const courseId = request?.course?.id;
  const courseQuery = useQuery({
    queryKey: ['checkout-course', courseId],
    queryFn: async () => {
      const res = (await api.get(`/courses/${courseId}`)) as unknown;
      return ((res as { data?: CourseDetail })?.data ?? res) as CourseDetail;
    },
    enabled: isOpen && Boolean(courseId),
  });

  const plans = (plansQuery.data ?? []).filter((p) => (p.price_monthly ?? 0) > 0 || (p.price_annual ?? 0) > 0);
  const course = courseQuery.data;
  const courseForSale = Boolean(course?.is_individually_purchasable && (course?.price ?? 0) > 0);
  // Default choice: the course itself when it's sold alone, else the highlighted plan.
  const effective: Choice | null = choice
    ?? (courseForSale ? { kind: 'course' } : plans.length ? { kind: 'plan', planId: (plans.find((p) => p.is_highlighted || p.slug === 'pro') ?? plans[0]).id } : null);
  const plan = effective?.kind === 'plan' ? plans.find((p) => p.id === effective.planId) : undefined;
  const planPrice = plan ? (cycle === 'annual' ? plan.price_annual : plan.price_monthly) ?? 0 : 0;
  const basePrice = effective?.kind === 'course' ? course?.price ?? 0 : planPrice;
  const discount = couponState?.discount ?? 0;
  const total = Math.max(0, basePrice - discount);
  const loading = plansQuery.isLoading || (Boolean(courseId) && courseQuery.isLoading);

  const reset = () => {
    setChoice(null); setCoupon(''); setCouponState(null); setError(null); setDone(null); setPaying(false);
  };
  const close = () => { if (paying) return; reset(); onClose(); };

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return;
    setCheckingCoupon(true);
    setError(null);
    try {
      if (effective?.kind === 'course') {
        // Course coupons are checked when the order is made; show it as pending.
        setCouponState({ code, discount: null, message: 'Applied at payment' });
        return;
      }
      const res = (await api.post('/v2/payments/validate-coupon', { code, plan_slug: plan?.slug, billing_cycle: cycle })) as any;
      const r = res?.data ?? res;
      if (!r?.valid) {
        setCouponState(null);
        setError(r?.reason || 'That coupon can\'t be used here.');
        return;
      }
      setCouponState({ code, discount: Number(r.discountAmount) || 0, message: `${rupees(r.discountAmount)} off` });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check that coupon.');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const pay = async () => {
    if (!effective) return;
    setPaying(true);
    setError(null);
    try {
      const title = effective.kind === 'course' ? `Course: ${course?.title}` : `${plan?.name} plan (${cycle})`;
      const order = orderOf(effective.kind === 'course'
        ? await api.post('/v2/payments/create-course-order', { course_id: course!.id, ...(couponState ? { coupon_code: couponState.code } : {}) })
        : await api.post('/v2/payments/create-order', { plan_id: plan!.id, billing_cycle: cycle, ...(couponState ? { coupon_code: couponState.code } : {}) }));
      setInGateway(!order.razorpayOrderId.startsWith('free_'));
      const outcome = await payOrder(order, {
        title, name: (user as any)?.full_name, email: user?.email,
        onFailedAttempt: (m) => toast.error(m),
      });
      if (outcome === 'cancelled') return;
      await qc.invalidateQueries();
      setDone(effective.kind === 'course' ? course?.title ?? 'your course' : `${plan?.name}`);
      request?.onUnlocked?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. You have not been charged.');
    } finally {
      setPaying(false);
      setInGateway(false);
    }
  };

  const payButton = (
    <button type="button" onClick={() => void pay()} disabled={!effective || paying || loading}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 disabled:opacity-60">
      {paying ? <><Loader2 className="h-4 w-4 animate-spin" />Waiting for payment…</> : total === 0 && effective ? 'Get it free' : `Pay ${rupees(total)}`}
    </button>
  );

  const heading = request?.course ? `Unlock ${request.course.title}` : 'Upgrade your plan';

  return (
    <Dialog open={isOpen && !inGateway} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-3xl overflow-y-auto p-0 sm:rounded-2xl">
        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" aria-hidden />
            <DialogTitle className="text-2xl font-bold">You're in!</DialogTitle>
            <DialogDescription>
              {request?.course && done === course?.title ? `${done} is yours for life.` : `${done} is active. Everything it includes is unlocked.`}
            </DialogDescription>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {request?.course && (
                <button type="button" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
                  onClick={() => { const id = request.course!.id; reset(); onClose(); navigate(`/course/${id}/chapters`); }}>
                  Start learning
                </button>
              )}
              <button type="button" className="rounded-xl border px-5 py-2.5 text-sm font-semibold" onClick={close}>Continue</button>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-[1fr_300px]">
            {/* Choices */}
            <div className="space-y-4 p-5 sm:p-6">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <Lock className="h-5 w-5 text-primary" aria-hidden />{heading}
                </DialogTitle>
                <DialogDescription className="mt-1">{request?.reason ?? 'Pick how you want to unlock it. You stay right here.'}</DialogDescription>
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" aria-label="Loading options" /></div>
              ) : (
                <div role="radiogroup" aria-label="What to buy" className="space-y-3">
                  {courseForSale && course && (
                    <OptionCard selected={effective?.kind === 'course'} onSelect={() => { setChoice({ kind: 'course' }); setCouponState(null); }}
                      icon={<BookOpen className="h-5 w-5" />} title="This course" price={rupees(course.price)} note="One-time · lifetime access"
                      points={['Every chapter, quiz and task', 'Certificate when you finish']} />
                  )}
                  {plans.map((p) => {
                    const copy = asList(p.features_copy).slice(0, 4);
                    const monthly = p.price_monthly ?? 0;
                    const annual = p.price_annual ?? 0;
                    return (
                      <OptionCard key={p.id} selected={effective?.kind === 'plan' && effective.planId === p.id}
                        onSelect={() => { setChoice({ kind: 'plan', planId: p.id }); setCouponState(null); }}
                        icon={<Crown className="h-5 w-5" />} title={`${p.name}${p.is_highlighted || p.slug === 'pro' ? ' · most popular' : ''}`}
                        price={cycle === 'annual' && annual ? `${rupees(annual)}/yr` : `${rupees(monthly)}/mo`}
                        note={cycle === 'annual' && annual && monthly ? `${rupees(Math.round(annual / 12))}/mo billed yearly · save ${Math.max(0, Math.round((1 - annual / (monthly * 12)) * 100))}%` : (p.tagline ?? 'Billed monthly · cancel anytime')}
                        points={copy.length ? copy : ['Every course and practice problem', 'Unlimited AI mentor', 'Certificates']} />
                    );
                  })}
                  {!courseForSale && !plans.length && (
                    <p className="rounded-xl border p-4 text-sm text-muted-foreground">Nothing is on sale right now. Please try again later.</p>
                  )}
                </div>
              )}

              {effective?.kind === 'plan' && (
                <div className="inline-flex rounded-xl border p-1 text-sm" role="group" aria-label="Billing">
                  {(['monthly', 'annual'] as Cycle[]).map((c) => (
                    <button key={c} type="button" aria-pressed={cycle === c} onClick={() => { setCycle(c); setCouponState(null); }}
                      className={cn('rounded-lg px-3 py-1.5 font-medium capitalize', cycle === c ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                      {c === 'annual' ? 'Yearly' : 'Monthly'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="space-y-4 border-t bg-muted/40 p-5 sm:p-6 md:border-l md:border-t-0">
              <h3 className="text-sm font-semibold">Order summary</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">
                  {effective?.kind === 'course' ? course?.title : plan ? `${plan.name} (${cycle === 'annual' ? 'yearly' : 'monthly'})` : '—'}
                </dt><dd className="tabular-nums">{rupees(basePrice)}</dd></div>
                {couponState && (
                  <div className="flex justify-between gap-2 text-emerald-600"><dt>Coupon {couponState.code}</dt>
                    <dd className="tabular-nums">{couponState.discount === null ? couponState.message : `−${rupees(couponState.discount)}`}</dd></div>
                )}
                <div className="flex justify-between gap-2 border-t pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{rupees(total)}</dd></div>
                <p className="text-xs text-muted-foreground">GST included. A GST invoice is in Billing after payment.</p>
              </dl>

              {couponState ? (
                <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline" onClick={() => setCouponState(null)}>
                  <X className="h-3 w-3" />Remove coupon
                </button>
              ) : (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void applyCoupon(); }}>
                  <label htmlFor="checkout-coupon" className="sr-only">Coupon code</label>
                  <input id="checkout-coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" maxLength={50}
                    className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm uppercase" />
                  <button type="submit" disabled={!coupon.trim() || checkingCoupon} className="inline-flex h-9 items-center gap-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-50">
                    {checkingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}Apply
                  </button>
                </form>
              )}

              {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>}

              <div className="hidden md:block">{payButton}</div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Secure payment by Razorpay. Cards, UPI, netbanking.</p>
            </div>
          </div>
        )}
        {/* Phones: the pay button stays in view at the bottom of the sheet. */}
        {!done && <div className="sticky bottom-0 border-t bg-background/95 p-4 backdrop-blur md:hidden">{payButton}</div>}
      </DialogContent>
    </Dialog>
  );
}

function OptionCard({ selected, onSelect, icon, title, price, note, points }: {
  selected: boolean; onSelect: () => void; icon: ReactNode; title: string; price: string; note?: string | null; points: string[];
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onSelect}
      className={cn('w-full rounded-xl border-2 p-4 text-left transition-colors', selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}>
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 rounded-lg p-1.5', selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold">{title}</span>
            <span className="font-bold tabular-nums">{price}</span>
          </div>
          {note && <p className="text-xs text-muted-foreground">{note}</p>}
          <ul className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {points.map((p) => <li key={p} className="flex items-start gap-1.5"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{p}</li>)}
          </ul>
        </div>
      </div>
    </button>
  );
}
