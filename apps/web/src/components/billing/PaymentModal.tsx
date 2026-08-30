import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Zap, Loader2, Target, Check } from 'lucide-react';
import { useApiQuery } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPlanSlug?: string;
}

export function PaymentModal({ isOpen, onClose, defaultPlanSlug = 'pro' }: PaymentModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: plansData, isLoading: plansLoading } = useApiQuery<any[]>(
    ['pricing-plans-v2'],
    '/v2/payments/plans',
    { enabled: isOpen }
  );

  const activePlans = plansData || [];
  const selectedPlan = activePlans.find(p => p.slug === defaultPlanSlug) || activePlans[0];

  const handleCheckout = async (planId: string) => {
    setLoadingPlan(planId);
    try {
      const res = await loadRazorpay();
      if (!res) {
        toast.error("Razorpay SDK failed to load.");
        return;
      }

      const { data: order } = await api.post("/v2/payments/create-order", {
        plan_id: planId,
        billing_cycle: isAnnual ? 'annual' : 'monthly',
      });

      const options = {
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.finalAmount,
        currency: order.currency || "INR",
        name: "DSA OS",
        description: order.plan.name + ' Plan',
        order_id: order.razorpayOrderId,
        prefill: {
          name: (user as any)?.user_metadata?.full_name || "Student",
          email: user?.email || ""
        },
        theme: { color: "#4f46e5" },
        handler: async function (response: any) {
          try {
            await api.post("/v2/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Welcome aboard.");
            onClose();
            window.location.reload(); // Quick refresh to update entitlements context
          } catch (err: any) {
            toast.error(err instanceof Error ? err.message : "Payment verification failed.");
          }
        }
      };

      const razor = new (window as any).Razorpay(options);
      razor.on('payment.failed', function (response: any) {
        toast.error(response.error.description || "Payment failed");
      });
      razor.open();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Failed to initiate checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* Left Side: Value Prop */}
          <div className="md:w-5/12 bg-indigo-600 p-8 flex flex-col justify-between text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-indigo-500 rounded-full blur-2xl opacity-50 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                <Target className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Unlock Your Full Potential</h3>
              <p className="text-indigo-100 text-sm mb-8">
                Get access to premium features, AI mentorship, and exclusive career paths.
              </p>
              
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-indigo-300" />
                  Unlimited AI Queries
                </li>
                <li className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-indigo-300" />
                  Advanced Projects
                </li>
                <li className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-indigo-300" />
                  Mock Interviews
                </li>
                <li className="flex items-center gap-3 text-sm font-medium">
                  <Check className="w-5 h-5 text-indigo-300" />
                  Premium Certificates
                </li>
              </ul>
            </div>
            
            <div className="relative z-10 mt-10">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-200">
                <Shield className="w-4 h-4" />
                7-day money-back guarantee
              </div>
            </div>
          </div>

          {/* Right Side: Checkout */}
          <div className="md:w-7/12 p-8 relative">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold text-white mb-6">Choose Your Plan</h2>

            {plansLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Toggle */}
                <div className="flex items-center justify-center gap-4 p-1 bg-slate-800 rounded-full w-max mx-auto mb-6">
                  <button
                    onClick={() => setIsAnnual(false)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${!isAnnual ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setIsAnnual(true)}
                    className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-colors ${isAnnual ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Annual <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded ml-1">SAVE 40%</span>
                  </button>
                </div>

                {/* Plan Options */}
                <div className="space-y-3">
                  {activePlans.filter((p) => p.price_monthly > 0).map((plan) => {
                    const rawPrice = isAnnual ? plan.price_annual : plan.price_monthly;
                    const price = rawPrice ? rawPrice / 100 : 0;
                    const isSelected = selectedPlan?.id === plan.id;

                    return (
                      <div
                        key={plan.id}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'bg-indigo-500/10 border-indigo-500' 
                            : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                        }`}
                        onClick={() => {
                          // Allow selection if multiple paid plans exist. For now, we auto-select the highest.
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-indigo-500' : 'border-slate-600'}`}>
                            {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                          </div>
                          <div>
                            <div className="font-bold text-white">{plan.name}</div>
                            <div className="text-xs text-slate-400">{plan.description}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-white">₹{price}</div>
                          <div className="text-xs text-slate-500">/{isAnnual ? 'yr' : 'mo'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Checkout Button */}
                <button
                  onClick={() => selectedPlan && handleCheckout(selectedPlan.id)}
                  disabled={!selectedPlan || !!loadingPlan}
                  className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center mt-6"
                >
                  {loadingPlan ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processing...</>
                  ) : (
                    <>Pay Securely with Razorpay</>
                  )}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
