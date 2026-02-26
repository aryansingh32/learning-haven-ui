import React, { useState } from "react";
import { Check, Zap, Target, Crown, Info, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/services/api.svc";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Usually fetched from backend, but hardcoded for demo as requested
const PLANS = [
    {
        id: "plan_basic",
        name: "Basic",
        price: 499,
        originalPrice: 999,
        icon: <Target className="w-5 h-5 text-blue-500" />,
        description: "Perfect for a quick semester revision.",
        features: [
            "Access to Semester Survival Plan",
            "30-Day Internship Sprint",
            "Basic Doubt Support",
            "Resume Review Template",
        ],
        highlight: false,
    },
    {
        id: "plan_pro",
        name: "Pro",
        price: 999,
        originalPrice: 1999,
        icon: <Zap className="w-5 h-5 text-yellow-500" />,
        description: "The complete placement preparation package.",
        features: [
            "90-Day Placement Roadmap",
            "1-on-1 Mock Interviews (2)",
            "Priority Doubt Resolution",
            "Exclusive Job Alerts",
            "All Basic Features",
        ],
        highlight: true,
        badge: "Most Popular",
    },
    {
        id: "plan_lifetime",
        name: "Lifetime",
        price: 2499,
        originalPrice: 4999,
        icon: <Crown className="w-5 h-5 text-purple-500" />,
        description: "Never worry about subscriptions again.",
        features: [
            "Lifetime Access to All Roadmaps",
            "Unlimited Mock Interviews",
            "Direct WhatsApp access to Mentors",
            "Dedicated Career Coach",
        ],
        highlight: false,
    },
];

export default function Pricing() {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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

    const handleSubscribe = async (plan: any) => {
        if (!isAuthenticated) {
            toast.info("Please sign up to subscribe strictly.");
            navigate("/signup?redirect=/pricing");
            return;
        }

        setLoadingPlan(plan.id);
        try {
            const res = await loadRazorpay();
            if (!res) {
                toast.error("Razorpay SDK failed to load. Are you offline?");
                setLoadingPlan(null);
                return;
            }

            // 1. Create Order
            const { data: order } = await api.post("/payments/create-order", { planId: plan.id });

            // 2. Open Checkout
            const options = {
                key: process.env.VITE_RAZORPAY_KEY_ID || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_YourKeyHere",
                amount: order.amount,
                currency: order.currency,
                name: "DSA OS",
                description: `Subscription to ${plan.name} Plan`,
                order_id: order.id,
                handler: async function (response: any) {
                    try {
                        await api.post("/payments/verify", {
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        toast.success("Payment successful! Your plan is now active.");
                        navigate("/dashboard");
                    } catch (err: any) {
                        toast.error(err?.response?.data?.error || "Payment verification failed.");
                    }
                },
                prefill: {
                    name: "Student",
                    email: "student@dsaos.in",
                },
                theme: {
                    color: "#2563EB",
                },
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
        <div className="min-h-screen bg-gray-50 py-16 px-4">
            {/* Header */}
            <div className="max-w-3xl mx-auto text-center mb-16">
                <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
                    Invest in Your Career Today
                </h1>
                <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                    Get the exact roadmap, curated content, and mentorship that has helped thousands of students clear top tech interviews.
                </p>

                <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded-full text-sm">
                    <Info className="w-4 h-4" />
                    7-Day Money-Back Guarantee on all plans
                </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 items-center lg:items-stretch">
                {PLANS.map((plan, i) => (
                    <motion.div
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.15, duration: 0.5, type: "spring" }}
                        className={`relative w-full rounded-3xl bg-white p-8 ${plan.highlight
                                ? "ring-4 ring-blue-600 shadow-2xl scale-100 lg:scale-105 z-10"
                                : "border border-gray-200 shadow-xl"
                            }`}
                    >
                        {plan.badge && (
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white font-bold text-xs uppercase tracking-widest py-1.5 px-4 rounded-full shadow-md whitespace-nowrap">
                                {plan.badge}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-2 rounded-xl ${plan.highlight ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                {plan.icon}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                        </div>

                        <p className="text-gray-500 text-sm mb-6 h-10">{plan.description}</p>

                        <div className="mb-6 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-gray-900">₹{plan.price}</span>
                            <span className="text-xl text-gray-400 line-through font-medium">₹{plan.originalPrice}</span>
                        </div>

                        <button
                            onClick={() => handleSubscribe(plan)}
                            disabled={!!loadingPlan}
                            className={`w-full h-12 rounded-xl font-bold text-sm transition-all duration-200 shadow-md ${plan.highlight
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-900 text-white hover:bg-gray-800"
                                }`}
                        >
                            {loadingPlan === plan.id ? (
                                <div className="flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                                </div>
                            ) : (
                                "Join Now"
                            )}
                        </button>

                        <div className="mt-8 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">What&apos;s included</p>
                            <ul className="space-y-3">
                                {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <Check className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-sm text-gray-600 font-medium">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Social Proof Footer */}
            <div className="max-w-3xl mx-auto mt-20 text-center border-t border-gray-200 pt-10">
                <p className="text-gray-500 font-medium text-sm mb-6">TRUSTED BY STUDENTS FROM</p>
                <div className="flex flex-wrap justify-center gap-6 md:gap-12 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                    {/* Placeholder logos */}
                    <span className="text-xl font-bold font-serif shadow-sm px-2">IIT Bombay</span>
                    <span className="text-xl font-bold font-mono shadow-sm px-2">NIT Trichy</span>
                    <span className="text-xl font-extrabold shadow-sm px-2">VIT Vellore</span>
                    <span className="text-xl font-bold italic shadow-sm px-2">BITS Pilani</span>
                </div>
            </div>
        </div>
    );
}
