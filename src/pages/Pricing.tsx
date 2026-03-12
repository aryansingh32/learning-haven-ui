import React, { useState } from "react";
import { Check, Zap, Target, Crown, Info, Loader2, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api.svc";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch"; // Assuming Shadcn UI Switch exists, else use standard toggle

const faqs = [
    {
        q: "Is there a free trial?",
        a: "Yes, 7 days free on any plan, no card needed."
    },
    {
        q: "Can I switch plans?",
        a: "Yes, upgrade/downgrade anytime from your profile."
    },
    {
        q: "What payment methods?",
        a: "All UPI, cards, netbanking via Razorpay."
    },
    {
        q: "Do you store my card?",
        a: "No. Razorpay handles all payment data."
    }
];

export default function Pricing() {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [isAnnual, setIsAnnual] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    const { data: plansData, isLoading: plansLoading } = useApiQuery<any[]>(
        ['pricing-plans'],
        '/payments/plans'
    );

    const { data: currentSub } = useApiQuery<any>(
        ['current-subscription'],
        '/subscriptions/current',
        { enabled: isAuthenticated }
    );

    // Filter displayed plans based on toggle
    const currentInterval = isAnnual ? 'yearly' : 'monthly';
    const activePlans = plansData?.filter((p: any) => p.interval === currentInterval) || [];

    const loadRazorpay = () => {
        return new Promise((resolve) => {
            if ((window as any).Razorpay) {
                resolve(true);
                return;
            }
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
                setLoadingPlan(null);
                return;
            }

            // 1. Create order
            // Note: backend expects { plan_id: planId }, returning { order_id, amount, currency, razorpay_key }
            const { data: order } = await api.post("/payments/create-order", { plan_id: planId });

            // 2. Open Checkout
            const options = {
                key: order.razorpay_key || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_YourKeyHere",
                amount: order.amount,
                currency: order.currency || "INR",
                name: "DSA OS",
                description: planId + ' plan',
                order_id: order.order_id || order.id,
                prefill: {
                    name: (user as any)?.user_metadata?.full_name || (user as any)?.name || "Student",
                    email: user?.email || "",
                    contact: (user as any)?.user_metadata?.phone || (user as any)?.phone || ""
                },
                theme: { color: "#1A56DB" },
                handler: async function (response: any) {
                    try {
                        await api.post("/payments/verify", {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        toast.success("Payment successful! Plan activated.");
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
            toast.error(err?.response?.data?.error || "Failed to create order. Try again.");
        } finally {
            setLoadingPlan(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-16 px-4 font-sans">
            {/* Header */}
            <div className="max-w-3xl mx-auto text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    Simple Pricing. Serious Results.
                </h1>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                    Everything you need to crack placements — at the cost of a Swiggy order.
                </p>
            </div>

            {/* Annual Toggle */}
            <div className="flex items-center justify-center gap-3 mb-12">
                <span className={`text-sm font-semibold ${!isAnnual ? "text-slate-900" : "text-slate-500"}`}>
                    Monthly
                </span>
                <button
                    onClick={() => setIsAnnual(!isAnnual)}
                    className={`relative w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 ${isAnnual ? "bg-blue-600" : "bg-slate-300"}`}
                >
                    <motion.div
                        className="w-5 h-5 bg-white rounded-full shadow-sm"
                        layout
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        initial={false}
                        animate={{ x: isAnnual ? 28 : 0 }}
                    />
                </button>
                <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${isAnnual ? "text-slate-900" : "text-slate-500"}`}>
                        Annual
                    </span>
                    <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Save 2 months
                    </span>
                </div>
            </div>

            {/* Pricing Cards Grid */}
            {plansLoading ? (
                <div className="flex justify-center my-20">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {activePlans.map((plan, i) => {
                        const isStandard = plan.name?.toLowerCase() === 'standard';
                        const isPro = plan.name?.toLowerCase() === 'pro';
                        const isCurrentPlan = currentSub?.plan_id === plan.id;

                        let IconElement = <Target className={`w-6 h-6 ${isStandard ? 'text-white' : 'text-blue-500'}`} />;
                        if (isPro) IconElement = <Crown className="w-6 h-6 text-purple-500" />;

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.15, duration: 0.5, type: "spring" }}
                                className={`relative w-full rounded-3xl p-8 flex flex-col h-full ${isStandard
                                    ? "bg-white ring-4 ring-blue-600 shadow-2xl scale-100 lg:scale-105 z-10"
                                    : "bg-white border border-slate-200 shadow-xl"
                                    }`}
                            >
                                {isStandard && (
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white font-bold text-[11px] uppercase tracking-widest py-1.5 px-4 rounded-full shadow-md whitespace-nowrap">
                                        Most Popular
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`p-2.5 rounded-xl ${isStandard ? 'bg-blue-600' : 'bg-slate-100'}`}>
                                        {IconElement}
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 uppercase tracking-tight">{plan.name}</h3>
                                </div>

                                <div className="mb-6 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-slate-900 tabular-nums">₹{plan.price / 100}</span>
                                    <span className="text-sm font-medium text-slate-500">/{isAnnual ? 'year' : 'month'}</span>
                                </div>

                                <button
                                    onClick={() => handleCheckout(plan.id)}
                                    disabled={!!loadingPlan || isCurrentPlan}
                                    className={`w-full h-12 rounded-xl font-bold text-sm transition-all duration-200 shadow-sm mb-8 ${isCurrentPlan
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                        : isStandard
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200"
                                            : "bg-slate-900 text-white hover:bg-slate-800"
                                        }`}
                                >
                                    {loadingPlan === plan.id ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                        </div>
                                    ) : isCurrentPlan ? (
                                        "Current Plan"
                                    ) : (!isAuthenticated ? (
                                        "Start Free Trial"
                                    ) : (
                                        `Upgrade to ${plan.name}`
                                    ))}
                                </button>

                                <div className="flex-1 space-y-4">
                                    <ul className="space-y-3">
                                        {Array.isArray(plan.features) && plan.features.map((feature: string, idx: number) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <Check className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                                                <span className="text-sm text-slate-700 font-medium leading-snug">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {Array.isArray(plan.not_included) && plan.not_included.length > 0 && (
                                        <ul className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                                            {plan.not_included.map((feature: string, idx: number) => (
                                                <li key={`missing-${idx}`} className="flex items-start gap-3 opacity-60">
                                                    <X className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                                                    <span className="text-sm text-slate-500 line-through">{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Guarantee Strip */}
            <div className="max-w-4xl mx-auto mt-16 text-center">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 md:gap-4 bg-white/60 backdrop-blur-sm border border-slate-200 text-slate-600 font-medium px-6 py-3 rounded-2xl shadow-sm text-sm">
                    <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> 30-day money-back guarantee</span>
                    <span className="hidden md:block text-slate-300">•</span>
                    <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> No credit card for trial</span>
                    <span className="hidden md:block text-slate-300">•</span>
                    <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-green-500" /> Cancel anytime</span>
                </div>
            </div>

            {/* FAQ Section */}
            <div className="max-w-3xl mx-auto mt-24">
                <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">Frequently Asked Questions</h2>
                <div className="space-y-4">
                    {faqs.map((faq, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all duration-200">
                            <button
                                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                                className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                            >
                                <span className="font-semibold text-slate-900">{faq.q}</span>
                                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${openFaq === idx ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                                {openFaq === idx && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="px-6 pb-6 text-slate-600"
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


