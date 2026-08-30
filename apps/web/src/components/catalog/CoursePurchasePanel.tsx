import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BadgeCheck, Infinity as InfinityIcon, Loader2, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api.svc';
import { useAuth } from '@/context/AuthContext';
import { coursePricing, type CatalogCourse } from './catalog-utils';

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

interface Props {
  course: CatalogCourse;
  /** Number of chapters, shown as part of what the purchase includes. */
  chapterCount?: number;
  onPurchased?: () => void;
}

/**
 * Coursera-style purchase panel for a single course: price, what's included,
 * and a one-time checkout that grants permanent access to this course.
 *
 * Renders nothing when the learner already has access — the caller decides
 * what to show instead (the chapter list).
 */
export function CoursePurchasePanel({ course, chapterCount, onPurchased }: Props) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ['my-course-access'],
    queryFn: async () => {
      try {
        return (await api.get('/courses/access/mine')) as unknown as {
          has_all_access: boolean;
          purchased_course_ids: string[];
        };
      } catch {
        return { has_all_access: false, purchased_course_ids: [] };
      }
    },
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const owned =
    Boolean(access?.has_all_access) || Boolean(access?.purchased_course_ids?.includes(course.id));
  const pricing = coursePricing(course, owned);

  // Nothing to sell: already owned, free, or plan-only (handled by the paywall).
  if (accessLoading || owned || pricing.kind === 'free' || pricing.kind === 'owned') return null;

  if (pricing.kind === 'plan_only') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-reward/25 bg-reward/5 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-reward" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-foreground">Included with Pro</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This course is part of the Pro catalogue. Subscribe once and unlock every course.
            </p>
            <button
              type="button"
              onClick={() => navigate(`/subscription?course_id=${course.id}&ref=course`)}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-amber-600 sm:w-auto sm:px-8"
            >
              See plans
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  const handleBuy = async () => {
    if (!isAuthenticated) {
      navigate(`/signin?next=${encodeURIComponent(`/course/${course.id}/chapters`)}`);
      return;
    }

    setLoading(true);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error('Could not load the payment gateway. Check your connection and retry.');
        return;
      }

      const { data: order } = await api.post('/v2/payments/course-order', {
        course_id: course.id,
      });

      const razor = new (window as any).Razorpay({
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.finalAmount,
        currency: order.currency || 'INR',
        name: 'Learning Haven',
        description: course.title,
        order_id: order.razorpayOrderId,
        prefill: {
          name: (user as any)?.full_name || (user as any)?.user_metadata?.full_name || '',
          email: user?.email || '',
        },
        theme: { color: '#f97316' },
        handler: async (response: any) => {
          try {
            await api.post('/v2/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['my-course-access'] }),
              queryClient.invalidateQueries({ queryKey: ['my-course-enrollments'] }),
              queryClient.invalidateQueries({ queryKey: ['user-entitlements'] }),
            ]);
            toast.success(`You now own ${course.title}. Happy learning!`);
            onPurchased?.();
          } catch (err: any) {
            // The charge succeeded but activation did not — never tell the
            // learner the payment failed, or they may pay again.
            toast.error(
              err?.message ||
                'Payment went through but access is still activating. Refresh in a moment, or contact support.'
            );
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });

      razor.on('payment.failed', (response: any) => {
        toast.error(response.error?.description || 'Payment failed. You have not been charged.');
      });
      razor.open();
    } catch (error: any) {
      toast.error(error?.message || 'Could not start checkout.');
    } finally {
      setLoading(false);
    }
  };

  const includes = [
    chapterCount && chapterCount > 0
      ? { icon: BadgeCheck, text: `All ${chapterCount} chapters, with hands-on tasks` }
      : { icon: BadgeCheck, text: 'Every chapter, with hands-on tasks' },
    { icon: InfinityIcon, text: 'Lifetime access — buy once, keep forever' },
    { icon: ShieldCheck, text: 'Certificate of completion' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-[var(--shadow-card)]"
    >
      <div className="border-b border-border/50 bg-gradient-to-br from-primary/5 to-transparent p-5 sm:p-6">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-3xl font-extrabold text-foreground">{pricing.price}</span>
          {pricing.originalPrice && (
            <span className="text-base text-muted-foreground line-through">{pricing.originalPrice}</span>
          )}
          {pricing.discountPercent != null && pricing.discountPercent > 0 && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
              {pricing.discountPercent}% off
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">One-time payment · inclusive of taxes</p>

        <button
          type="button"
          onClick={() => void handleBuy()}
          disabled={loading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:from-orange-600 hover:to-amber-600 hover:shadow-xl disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
          {loading ? 'Opening checkout…' : `Enrol for ${pricing.price}`}
        </button>

        <button
          type="button"
          onClick={() => navigate(`/subscription?course_id=${course.id}&ref=course`)}
          className="mt-2 w-full rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary"
        >
          Or unlock every course with Pro
        </button>
      </div>

      <ul className="space-y-2.5 p-5 sm:p-6">
        {includes.map((item) => (
          <li key={item.text} className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
