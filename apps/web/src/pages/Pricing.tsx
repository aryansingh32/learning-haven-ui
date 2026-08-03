import React, { useState } from "react";
import { Check, Zap, Target, Crown, Info, Loader2, X, ChevronDown, Shield, Ticket, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api.svc";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useEntitlements } from "@/services/entitlement.service";

const faqs = [
  { q: "Is there a free trial?", a: "We offer a 7-day money-back guarantee on all our paid plans. If you are not satisfied, you can cancel and request a refund." },
  { q: "Can I switch plans?", a: "Yes! You can upgrade or downgrade your plan at any time. Your billing will be prorated automatically." },
  { q: "What payment methods are supported?", a: "We accept all major credit cards, UPI, and Netbanking via our secure Razorpay integration." },
  { q: "Do you store my card details?", a: "No, we don't store your card details. All payments are securely processed by Razorpay." }
];

export default function Pricing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const { isPaid, entitlements } = useEntitlements();

  const { data: plansData, isLoading: plansLoading } = useApiQuery<any[]>(
    ['pricing-plans-live'],
    '/plans'
  );

  const { data: currentSub } = useApiQuery<any>(
    ['current-subscription-v2'],
    '/v2/payments/subscription',
    { enabled: isAuthenticated }
  );

  // Safely extract plans array to prevent .map errors
  const activePlans = Array.isArray(plansData) ? plansData : ((plansData as any)?.data || []);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await api.post('/v2/payments/validate-coupon', { code: couponCode.trim().toUpperCase() });
      setCouponApplied(res);
      toast.success(`Coupon applied successfully!`);
    } catch (err: any) {
      setCouponApplied(null);
      toast.error(err?.response?.data?.error || 'Invalid coupon code');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode('');
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

  const handleCheckout = async (planId: string) => {
    if (!isAuthenticated) {
      navigate("/signup?plan=" + planId);
      return;
    }

    setLoadingPlan(planId);
    try {
      const res = await loadRazorpay();
      if (!res) {
        toast.error("Razorpay SDK failed to load. Are you offline?");
        return;
      }

      // Create order via V2
      const { data: order } = await api.post("/v2/payments/create-order", {
        plan_id: planId,
        billing_cycle: isAnnual ? 'annual' : 'monthly',
        ...(couponApplied?.coupon?.code ? { coupon_code: couponApplied.coupon.code } : {}),
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
        theme: { color: "#4f46e5" }, // Indigo
        handler: async function (response: any) {
          try {
            await api.post("/v2/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Welcome aboard.");
            navigate("/dashboard?upgraded=true");
          } catch (err: any) {
            toast.error(err?.response?.data?.error || "Payment verification failed.");
          }
        }
      };

      const razor = new (window as any).Razorpay(options);
      razor.on('payment.failed', function (response: any) {
        toast.error(response.error.description || "Payment failed");
      });
      razor.open();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to initiate checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-20 px-4 font-sans text-slate-50 overflow-hidden relative">
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 max-w-3xl mx-auto text-center mb-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-semibold mb-6">
          <Star className="w-4 h-4" /> 
          Unleash Your Potential
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-5xl md:text-6xl font-extrabold mb-6 tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
          Simple Pricing.<br />Serious Results.
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-xl text-slate-400 max-w-2xl mx-auto">
          Choose the plan that fits your goals. Master DSA, build projects, and crack your dream job.
        </motion.p>
      </div>

      {isPaid && (
        <div className="relative z-10 max-w-2xl mx-auto mb-10 text-center">
          <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold shadow-lg shadow-emerald-500/5">
            <Shield className="w-4 h-4" />
            Active Plan: {entitlements.plan_name}
          </span>
        </div>
      )}

      {/* Annual Toggle */}
      <div className="relative z-10 flex items-center justify-center gap-4 mb-16">
        <span className={`text-sm font-semibold transition-colors ${!isAnnual ? "text-white" : "text-slate-500"}`}>
          Monthly
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          className={`relative w-16 h-8 flex items-center rounded-full p-1 transition-all duration-300 ${isAnnual ? "bg-indigo-600" : "bg-slate-700"}`}
        >
          <motion.div
            className="w-6 h-6 bg-white rounded-full shadow-md"
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            initial={false}
            animate={{ x: isAnnual ? 32 : 0 }}
          />
        </button>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold transition-colors ${isAnnual ? "text-white" : "text-slate-500"}`}>
            Annually
          </span>
          <span className="text-[11px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Save up to 40%
          </span>
        </div>
      </div>

      {/* Coupon */}
      <div className="relative z-10 max-w-md mx-auto mb-16">
        {couponApplied ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-4 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300">
                {couponApplied.coupon.code} applied!
              </span>
            </div>
            <button onClick={removeCoupon} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        ) : (
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                placeholder="Promo code"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-700 bg-slate-800/50 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500 backdrop-blur-md"
              />
            </div>
            <button
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="px-6 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
            </button>
          </div>
        )}
      </div>

      {/* Pricing Cards */}
      {plansLoading ? (
        <div className="flex justify-center my-32">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {activePlans.map((plan: any, i: number) => {
            const isStandard = plan.slug === 'pro';
            const isCurrentPlan = currentSub?.plan?.slug === plan.slug;
            
            // Derive price based on toggle
            const rawPrice = isAnnual ? plan.price_annual : plan.price_monthly;
            const price = rawPrice ? rawPrice / 100 : 0;
            
            const includedCourses = Array.isArray(plan.courses) ? plan.courses.map((course: any) => course.title) : [];
            const includedChallenges = Array.isArray(plan.challenges) ? plan.challenges.map((challenge: any) => challenge.title) : [];
            const featureRows = Object.entries(plan.features || {}).map(([key, value]) => {
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
              if (value === -1) return `${label}: Unlimited`;
              if (value === 0) return `${label}: Not included`;
              return `${label}: ${value}`;
            });
            const features = [
              ...includedCourses.map((title: string) => `Course: ${title}`),
              ...includedChallenges.map((title: string) => `Challenge: ${title}`),
              ...featureRows,
            ];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15, duration: 0.6, type: "spring" }}
                className={`relative flex flex-col h-full rounded-[2rem] p-8 ${
                  isStandard
                    ? "bg-gradient-to-b from-indigo-900/40 to-slate-900 border-2 border-indigo-500/50 shadow-2xl shadow-indigo-500/20 lg:-mt-4 lg:mb-4 z-20"
                    : "bg-slate-900/50 border border-slate-800 backdrop-blur-sm z-10"
                }`}
              >
                {isStandard && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-xs uppercase tracking-widest py-1.5 px-5 rounded-full shadow-lg">
                    Recommended
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white tracking-tight mb-2">{plan.name}</h3>
                  <p className="text-slate-400 text-sm line-clamp-2 h-10">{plan.description}</p>
                </div>

                <div className="mb-8">
                  {price === 0 ? (
                    <span className="text-5xl font-extrabold text-white">Free</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-slate-300">₹</span>
                      <span className="text-6xl font-extrabold text-white tabular-nums tracking-tighter">{price}</span>
                      <span className="text-sm font-medium text-slate-500 ml-1">/{isAnnual ? 'yr' : 'mo'}</span>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={!!loadingPlan || isCurrentPlan}
                  className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all duration-300 mb-10 ${
                    isCurrentPlan
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-not-allowed"
                      : isStandard
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                      : "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
                  }`}
                >
                  {loadingPlan === plan.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                    </div>
                  ) : isCurrentPlan ? (
                    "Current Plan"
                  ) : price === 0 ? (
                    "Get Started Free"
                  ) : (
                    "Choose Plan"
                  )}
                </button>

                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200 mb-4 uppercase tracking-wider">What's included</p>
                  <ul className="space-y-4">
                    {features.map((feature: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-300 leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto mt-20 grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          "Priya from Patna — Backend Developer at TCS, ₹8.2L",
          "Ravi from Nagpur — cleared Wipro interview in 4 months",
          "Ananya from Indore — Java Developer, ₹7.5L",
        ].map((quote) => (
          <div key={quote} className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-sm text-slate-300">
            {quote}
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="relative z-10 max-w-3xl mx-auto mt-32 mb-20">
        <h2 className="text-3xl font-bold text-center text-white mb-12">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-200 backdrop-blur-sm">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
              >
                <span className="font-semibold text-slate-200">{faq.q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform duration-300 ${openFaq === idx ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 pb-6 text-slate-400 text-sm leading-relaxed"
                  >
                    {faq.a}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
