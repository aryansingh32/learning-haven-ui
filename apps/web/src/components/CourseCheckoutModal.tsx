/**
 * CourseCheckoutModal
 * 
 * Handles per-course individual purchase via Razorpay.
 * Shown when a user clicks a course that is_individually_purchasable=true
 * and they are not yet entitled to it.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, ShieldCheck, CreditCard, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/services/api.svc';
import { useQueryClient } from '@tanstack/react-query';

interface CourseCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  course: {
    id: string;
    title: string;
    description?: string;
    price: number;
    currency?: string;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

/** Format price from paise to display string */
function formatPrice(paise: number, currency = 'INR'): string {
  const amount = paise / 100;
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`;
  return `${currency} ${amount.toFixed(2)}`;
}

/** Lazy-load Razorpay SDK */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

export function CourseCheckoutModal({ open, onClose, course }: CourseCheckoutModalProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'confirm' | 'processing'>('confirm');

  // Reset state when modal reopens
  useEffect(() => {
    if (open) setStep('confirm');
  }, [open]);

  async function handlePurchase() {
    setIsLoading(true);
    try {
      await loadRazorpayScript();

      // 1. Create order
      const orderRes: any = await api.post('/v2/payments/create-course-order', {
        course_id: course.id,
      });
      const { razorpayOrderId, finalAmount, keyId } = orderRes.data;

      // Handle free course (price = 0 after coupons)
      if (razorpayOrderId.startsWith('free_course_')) {
        await verifyOrder(razorpayOrderId, '', '');
        return;
      }

      // 2. Open Razorpay checkout
      setStep('processing');
      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: keyId,
          amount: finalAmount,
          currency: course.currency || 'INR',
          name: 'Learning Haven',
          description: `Unlock: ${course.title}`,
          order_id: razorpayOrderId,
          handler: async (response: any) => {
            try {
              await verifyOrder(
                razorpayOrderId,
                response.razorpay_payment_id,
                response.razorpay_signature,
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
          prefill: { name: '', email: '', contact: '' },
          theme: { color: '#7C3AED' },
        });
        rzp.open();
      });
    } catch (err: any) {
      if (err?.message !== 'Payment cancelled') {
        toast.error(err?.response?.data?.message || err?.message || 'Payment failed. Please try again.');
      }
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyOrder(orderId: string, paymentId: string, signature: string) {
    await api.post('/v2/payments/verify', {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId || orderId, // free orders use orderId as dummy
      razorpay_signature: signature || 'free',
    });

    // Invalidate entitlements and enrollment caches
    qc.invalidateQueries({ queryKey: ['my-course-enrollments'] });
    qc.invalidateQueries({ queryKey: ['entitlements'] });

    toast.success(`You now have access to "${course.title}"! 🎉`);
    onClose();
    navigate(`/course/${course.id}/chapters`);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4"
          >
            <div className="relative rounded-3xl border border-border/60 bg-card shadow-2xl overflow-hidden">
              {/* Gradient top accent */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-reward to-primary" />

              {/* Close */}
              <button
                onClick={onClose}
                disabled={isLoading}
                className="absolute right-4 top-4 p-1.5 rounded-xl text-muted-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 pt-7 space-y-5">
                {/* Course info */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">
                      Unlock Course
                    </p>
                    <h2 className="font-display text-lg font-bold text-foreground leading-snug">
                      {course.title}
                    </h2>
                    {course.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="rounded-2xl border border-border/50 bg-secondary/30 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">One-time price</p>
                    <p className="font-display text-2xl font-bold text-foreground">
                      {formatPrice(course.price, course.currency)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Incl. GST · Lifetime access</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                      <ShieldCheck className="w-3 h-3" /> Secure checkout
                    </div>
                    <div className="text-[10px] text-muted-foreground">Powered by Razorpay</div>
                  </div>
                </div>

                {/* What you get */}
                <div className="space-y-1.5">
                  {[
                    'Lifetime access to all chapters',
                    'Chapter-by-chapter guided learning',
                    'AI mentor support throughout the course',
                    'Certificate of completion',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2.5 pt-1">
                  <button
                    onClick={handlePurchase}
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all shadow-lg shadow-primary/25 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {step === 'processing' ? 'Processing payment...' : 'Preparing checkout...'}
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay {formatPrice(course.price, course.currency)}
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => navigate(`/subscription?course_id=${course.id}&ref=course_checkout`)}
                    disabled={isLoading}
                    className="w-full py-2.5 rounded-2xl border border-border/60 text-sm font-semibold text-muted-foreground hover:bg-secondary/40 hover:text-foreground transition-all disabled:opacity-50"
                  >
                    Get Pro instead — unlock every course
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
