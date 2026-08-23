/**
 * SubscriptionPage — User's billing, subscription, and order history.
 *
 * Shows:
 * - Current plan with status
 * - Subscription management (cancel/upgrade)
 * - Order history
 * - Entitlement summary
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Shield, Crown, Zap, CreditCard, Calendar, ArrowRight,
  ChevronDown, AlertTriangle, Check, Loader2, Receipt,
  Clock, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntitlements } from '@/services/entitlement.service';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const contextCourseId = searchParams.get('course_id');
  const { tier, isPaid, entitlements } = useEntitlements();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const { data: subscription, isLoading: subLoading, refetch: refetchSub } = useApiQuery<any>(
    ['current-subscription-v2'],
    '/v2/payments/subscription',
  );

  const { data: orders, isLoading: ordersLoading } = useApiQuery<any[]>(
    ['user-orders-v2'],
    '/v2/payments/history',
  );

  const cancelMutation = useApiMutation<any, void>(
    () => api.post('/v2/payments/cancel-subscription'),
    {
      onSuccess: () => {
        toast.success('Subscription cancelled. You retain access until the end of your billing period.');
        refetchSub();
        setShowCancelConfirm(false);
      },
      onError: (err: any) => {
        toast.error(err.message || 'Failed to cancel subscription');
      },
    }
  );

  const tierConfig = {
    free: { label: 'Free', color: 'text-slate-500', bg: 'bg-slate-100', icon: Zap },
    pro: { label: 'Pro', color: 'text-blue-600', bg: 'bg-blue-50', icon: Crown },
    career_accelerator: { label: 'Career Accelerator', color: 'text-purple-600', bg: 'bg-purple-50', icon: Shield },
    enterprise: { label: 'Enterprise', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Shield },
  };

  const current = tierConfig[tier] || tierConfig.free;
  const TierIcon = current.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your plan, view orders, and track entitlements.</p>
      </div>

      {/* BH-4.4: Contextual banner when arriving from course catalog */}
      {contextCourseId && !isPaid && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-reward/10 p-4 flex items-center gap-4"
        >
          <Crown className="w-8 h-8 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Unlock this course with Pro</p>
            <p className="text-xs text-muted-foreground">A Pro subscription gives you unlimited access to every course, AI mentor, and career tools.</p>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors"
          >
            See plans
          </button>
        </motion.div>
      )}

      {/* Current Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'rounded-2xl border p-6',
          isPaid
            ? 'border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent'
            : 'border-border/40 card-glass'
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', current.bg)}>
              <TierIcon className={cn('w-6 h-6', current.color)} />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-foreground">{current.label} Plan</h2>
              <p className="text-xs text-muted-foreground">
                {subscription?.status === 'active'
                  ? `Active since ${new Date(subscription.current_period_start).toLocaleDateString()}`
                  : isPaid ? 'Active' : 'Free tier'}
              </p>
            </div>
          </div>
          {isPaid && subscription?.status === 'active' && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-success/10 text-success font-bold border border-success/20">
              Active
            </span>
          )}
        </div>

        {/* Plan Features Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'AI Queries', value: isPaid ? 'Unlimited' : `${entitlements.limits.ai_queries_per_day}/day` },
            { label: 'Projects', value: isPaid ? 'All' : `${entitlements.limits.projects_available}` },
            { label: 'Certificates', value: isPaid ? 'Premium' : 'Basic' },
            { label: 'Career Insights', value: isPaid ? '✓' : '—' },
          ].map(item => (
            <div key={item.label} className="rounded-xl bg-secondary/30 p-3 text-center">
              <p className="text-sm font-bold text-foreground">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!isPaid ? (
            <button
              onClick={() => navigate('/pricing')}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:-translate-y-0.5 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              Upgrade to Pro <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/pricing')}
                className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors border border-border/40"
              >
                Change Plan
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-5 py-3 rounded-xl text-destructive font-semibold text-sm hover:bg-destructive/10 transition-colors border border-destructive/20"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        {/* Next billing */}
        {subscription?.current_period_end && (
          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Next billing: {new Date(subscription.current_period_end).toLocaleDateString()}
            {subscription.cancel_at_period_end && (
              <span className="ml-2 text-destructive font-semibold">(Cancels at period end)</span>
            )}
          </p>
        )}
      </motion.div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowCancelConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl border border-border p-6 max-w-md w-full shadow-2xl"
            >
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
              <h3 className="text-lg font-bold text-foreground text-center mb-2">Cancel Subscription?</h3>
              <p className="text-sm text-muted-foreground text-center mb-5">
                You'll lose access to premium features at the end of your current billing period. Your progress will be saved.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm"
                >
                  Keep Plan
                </button>
                <button
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-destructive text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Cancel Plan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order History */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card-glass rounded-2xl p-5 border border-border/40"
      >
        <h3 className="text-sm font-display font-bold text-foreground mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" />
          Order History
        </h3>

        {ordersLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !Array.isArray(orders) || orders.length === 0 ? (
          <div className="text-center py-10 opacity-50">
            <CreditCard className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders yet</p>
            <button
              onClick={() => navigate('/pricing')}
              className="mt-3 text-xs text-primary font-semibold hover:underline"
            >
              View Plans →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order: any, i: number) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-4 rounded-xl bg-secondary/20 hover:bg-secondary/30 transition-colors border border-border/20"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center',
                    (order.status === 'captured' || order.status === 'paid') ? 'bg-success/10' : order.status === 'failed' ? 'bg-destructive/10' : 'bg-secondary'
                  )}>
                    {(order.status === 'captured' || order.status === 'paid') ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : order.status === 'failed' ? (
                      <AlertTriangle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {order.plan_name || order.product_name || 'Plan Purchase'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString()} • {order.razorpay_payment_id ? `#${order.razorpay_payment_id.slice(-8)}` : order.id?.slice(0, 8)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground tabular-nums">
                    ₹{((order.final_amount !== undefined ? order.final_amount : order.amount) / 100).toLocaleString('en-IN')}
                  </p>
                  <span className={cn(
                    'text-[10px] font-semibold',
                    (order.status === 'captured' || order.status === 'paid') ? 'text-success' : order.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                  )}>
                    {(order.status === 'captured' || order.status === 'paid') ? 'Paid' : order.status === 'failed' ? 'Failed' : 'Pending'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
