import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Loader2, X } from 'lucide-react';
import { api } from '@/services/api.svc';
import { useApiQuery } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  variant: 'chapter_locked' | 'feature_limit' | 'content_preview';
  contentTitle?: string;
  featureKey?: string;
  featureUsed?: number;
  featureLimit?: number;
  requiredPlanSlug?: string;
  requiredPlanName?: string;
  requiredPlanPrice?: number;
  streakDays?: number;
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PaywallModal({
  open,
  onClose,
  variant,
  contentTitle,
  featureUsed,
  featureLimit,
  requiredPlanSlug = 'pro',
  requiredPlanName = 'Pro',
  requiredPlanPrice,
  streakDays,
}: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: plansData } = useApiQuery<any[]>(['pricing-plans-live'], '/plans', { enabled: open });
  const plans = Array.isArray(plansData) ? plansData : ((plansData as any)?.data || []);
  const plan = plans.find((item: any) => item.slug === requiredPlanSlug);
  const annualPrice = (plan?.price_annual ?? requiredPlanPrice ?? 0) / 100;
  const monthlyPrice = (plan?.price_monthly ?? 0) / 100;

  const copy = useMemo(() => {
    if (variant === 'feature_limit') {
      return {
        headline: 'Daily AI Mentor limit reached',
        sub: `You've used ${featureUsed ?? 0}/${featureLimit ?? 0} queries today.`,
        body: 'Upgrade to Pro for unlimited help. Less than one Swiggy order a month.',
        cta: `Unlock with ${requiredPlanName}`,
      };
    }
    if (variant === 'content_preview') {
      return {
        headline: `Your ${contentTitle || 'career'} roadmap is ready`,
        sub: '52,000+ Backend Developer jobs are open right now.',
        body: 'Follow your personalized roadmap, earn a certificate, and land your first role.',
        cta: `Unlock with ${requiredPlanName}`,
      };
    }
    return {
      headline: `This chapter is in ${requiredPlanName}`,
      sub: `${contentTitle || 'This course'} - unlock all chapters with one subscription`,
      body: streakDays && streakDays > 3 ? `Don't break your ${streakDays}-day streak - keep learning today.` : '',
      cta: `Unlock with ${requiredPlanName}`,
    };
  }, [contentTitle, featureLimit, featureUsed, requiredPlanName, streakDays, variant]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Razorpay SDK failed to load.');
        return;
      }
      if (!plan?.id) {
        toast.error('Plan is not available right now.');
        return;
      }

      const { data: order } = await api.post('/v2/payments/create-order', {
        plan_id: plan?.id,
        billing_cycle: 'annual',
      });

      const razor = new (window as any).Razorpay({
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.finalAmount,
        currency: order.currency || 'INR',
        name: 'DSA OS',
        description: `${requiredPlanName} Plan`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: (user as any)?.user_metadata?.full_name || 'Student',
          email: user?.email || '',
        },
        theme: { color: '#4f46e5' },
        handler: async (response: any) => {
          await api.post('/v2/payments/verify', {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['my-plan'] }),
            queryClient.invalidateQueries({ queryKey: ['user-entitlements'] }),
            queryClient.invalidateQueries({ queryKey: ['pricing-plans-live'] }),
          ]);
          toast.success('Plan activated. Pro access is now available.');
          onClose();
        },
      });

      razor.on('payment.failed', (response: any) => {
        toast.error(response.error?.description || 'Payment failed');
      });
      razor.open();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to start checkout.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-slate-50 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="pr-10 text-2xl font-bold tracking-tight">{copy.headline}</h2>
        <p className="mt-2 text-sm text-slate-300">{copy.sub}</p>
        {copy.body && <p className="mt-4 text-sm text-slate-400">{copy.body}</p>}

        <div className="mt-6 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-white">{requiredPlanName}</div>
              <div className="mt-1 text-xs text-slate-400">Annual billing unlocks the best price.</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">₹{annualPrice}</div>
              {!!monthlyPrice && <div className="text-xs text-slate-400">₹{monthlyPrice}/mo</div>}
            </div>
          </div>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
          {copy.cta}
        </button>
        {variant === 'feature_limit' && (
          <button onClick={onClose} className="mt-3 w-full rounded-xl px-4 py-2 text-sm text-slate-400 hover:text-white">
            Come back tomorrow
          </button>
        )}
      </div>
    </div>
  );
}

export default PaywallModal;
