import { useMemo, useState } from "react";
import { Check, Loader2, X, ChevronDown, Shield, Ticket, Star, Sparkles, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/services/api.svc";
import { useApiQuery } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useEntitlements } from "@/services/entitlement.service";

const faqs = [
  { q: "Is there a free trial?", a: "We offer a 7-day money-back guarantee on all our paid plans. If you are not satisfied, you can cancel and request a refund." },
  { q: "Can I buy a single course instead of a plan?", a: "Yes. Any course with a listed price can be bought on its own from its course page — that gives you lifetime access to that course. A plan is the better value if you want the whole catalogue." },
  { q: "Can I switch plans?", a: "Yes! You can upgrade or downgrade your plan at any time. Your billing will be prorated automatically." },
  { q: "What payment methods are supported?", a: "We accept all major credit cards, UPI, and Netbanking via our secure Razorpay integration." },
  { q: "Do you store my card details?", a: "No, we don't store your card details. All payments are securely processed by Razorpay." },
];

/** Turn a feature_key limit map into readable lines, used when a plan has no
 *  admin-authored marketing copy to show instead. */
function derivedFeatureLines(features: Record<string, unknown> | undefined): string[] {
  return Object.entries(features || {}).map(([key, value]) => {
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    if (value === -1) return `${label}: Unlimited`;
    if (value === 0) return `${label}: Not included`;
    return `${label}: ${value}`;
  });
}

function formatPrice(paise: number): string {
  return Math.round(paise / 100).toLocaleString("en-IN");
}

export default function Pricing() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const { isPaid, entitlements } = useEntitlements();

  const { data: plansData, isLoading: plansLoading } = useApiQuery<any[]>(
    ["pricing-plans-live"],
    "/plans"
  );

  const { data: currentSub } = useApiQuery<any>(
    ["current-subscription-v2"],
    "/v2/payments/subscription",
    { enabled: isAuthenticated }
  );

  const activePlans = Array.isArray(plansData) ? plansData : ((plansData as any)?.data || []);

  // Show the real best annual saving across plans rather than a fixed claim.
  const maxAnnualSaving = useMemo(() => {
    let best = 0;
    for (const plan of activePlans) {
      const monthly = plan.price_monthly;
      const annual = plan.price_annual;
      if (!monthly || !annual || monthly <= 0) continue;
      const saving = Math.round((1 - annual / (monthly * 12)) * 100);
      if (saving > best) best = saving;
    }
    return best;
  }, [activePlans]);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    try {
      const res = await api.post("/v2/payments/validate-coupon", { code: couponCode.trim().toUpperCase() });
      setCouponApplied(res);
      toast.success("Coupon applied successfully!");
    } catch (err: unknown) {
      setCouponApplied(null);
      // The API interceptor rejects with a plain Error carrying the server's
      // message — an axios-shaped `.response` is never present.
      toast.error(err instanceof Error ? err.message : "Invalid coupon code");
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponCode("");
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if ((window as any).Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const handleCheckout = async (planId: string) => {
    if (!isAuthenticated) {
      navigate("/signup?plan=" + planId);
      return;
    }

    setLoadingPlan(planId);
    try {
      const loaded = await loadRazorpay();
      if (!loaded) {
        toast.error("Could not load the payment gateway. Check your connection and retry.");
        return;
      }

      const { data: order } = await api.post("/v2/payments/create-order", {
        plan_id: planId,
        billing_cycle: isAnnual ? "annual" : "monthly",
        ...(couponApplied?.coupon?.code ? { coupon_code: couponApplied.coupon.code } : {}),
      });

      const razor = new (window as any).Razorpay({
        key: order.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.finalAmount,
        currency: order.currency || "INR",
        name: "Learning Haven",
        description: `${order.plan.name} Plan`,
        order_id: order.razorpayOrderId,
        prefill: {
          name: (user as any)?.full_name || (user as any)?.user_metadata?.full_name || "",
          email: user?.email || "",
        },
        theme: { color: "#f97316" },
        handler: async (response: any) => {
          try {
            await api.post("/v2/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment successful! Welcome aboard.");
            navigate("/dashboard?upgraded=true");
          } catch (err: unknown) {
            // Charged but not yet activated — never say the payment failed,
            // or the learner may pay a second time.
            toast.error(
              err instanceof Error
                ? err.message
                : "Payment went through but your plan is still activating. Refresh in a moment."
            );
          }
        },
        modal: { ondismiss: () => setLoadingPlan(null) },
      });

      razor.on("payment.failed", (response: any) => {
        toast.error(response.error?.description || "Payment failed. You have not been charged.");
      });
      razor.open();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-16 font-sans text-foreground sm:py-20">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-full max-w-4xl -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-reward/10 blur-[100px]" />

      {/* Header */}
      <div className="relative z-10 mx-auto mb-12 max-w-3xl text-center sm:mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary"
        >
          <Star className="h-4 w-4" />
          Built for placement season
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5 font-display text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl"
        >
          Simple pricing.
          <br />
          <span className="text-gradient-golden">Serious results.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-xl"
        >
          Master DSA, build real systems, and get interview-ready. Subscribe for the whole
          catalogue, or buy a single course outright.
        </motion.p>
      </div>

      {isPaid && (
        <div className="relative z-10 mx-auto mb-10 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/10 px-5 py-2.5 text-sm font-semibold text-success">
            <Shield className="h-4 w-4" />
            Active plan: {entitlements.plan_name}
          </span>
        </div>
      )}

      {/* Billing toggle */}
      <div className="relative z-10 mb-10 flex flex-wrap items-center justify-center gap-3 sm:mb-14 sm:gap-4">
        <span className={cn("text-sm font-semibold transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
          Monthly
        </span>
        <button
          onClick={() => setIsAnnual(!isAnnual)}
          role="switch"
          aria-checked={isAnnual}
          aria-label="Toggle annual billing"
          className={cn(
            "relative flex h-8 w-16 items-center rounded-full p-1 transition-colors duration-300",
            isAnnual ? "bg-primary" : "bg-secondary"
          )}
        >
          <motion.div
            className="h-6 w-6 rounded-full bg-white shadow-md"
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            initial={false}
            animate={{ x: isAnnual ? 32 : 0 }}
          />
        </button>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold transition-colors", isAnnual ? "text-foreground" : "text-muted-foreground")}>
            Annually
          </span>
          {maxAnnualSaving > 0 && (
            <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-success">
              Save up to {maxAnnualSaving}%
            </span>
          )}
        </div>
      </div>

      {/* Coupon */}
      <div className="relative z-10 mx-auto mb-12 max-w-md sm:mb-16">
        {couponApplied ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center justify-between rounded-xl border border-success/20 bg-success/10 px-5 py-4"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Ticket className="h-5 w-5 shrink-0 text-success" />
              <span className="truncate text-sm font-semibold text-success">
                {couponApplied.coupon.code} applied
              </span>
            </div>
            <button onClick={removeCoupon} aria-label="Remove coupon" className="shrink-0 text-success transition-opacity hover:opacity-70">
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        ) : (
          <div className="flex gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                placeholder="Promo code"
                aria-label="Promo code"
                className="w-full rounded-xl border border-border bg-card py-3.5 pl-12 pr-4 text-sm transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <button
              onClick={handleApplyCoupon}
              disabled={couponLoading || !couponCode.trim()}
              className="shrink-0 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50 sm:px-6"
            >
              {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
            </button>
          </div>
        )}
      </div>

      {/* Plans */}
      {plansLoading ? (
        <div className="my-32 flex justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : activePlans.length === 0 ? (
        <div className="relative z-10 mx-auto max-w-md rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Plans are not available right now. Please try again shortly.
        </div>
      ) : (
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {activePlans.map((plan: any, i: number) => {
            const isHighlighted = plan.is_highlighted || plan.slug === "pro";
            const isCurrentPlan = currentSub?.plan?.slug === plan.slug;

            const rawPrice = isAnnual ? plan.price_annual : plan.price_monthly;
            const priceValue = rawPrice ?? 0;

            // Prefer the admin-authored marketing list; fall back to the
            // derived entitlement limits only when there is no copy to show.
            const copyList: string[] = Array.isArray(plan.features_copy)
              ? plan.features_copy.filter((f: unknown): f is string => typeof f === "string")
              : [];
            const includedCourses = Array.isArray(plan.courses)
              ? plan.courses.map((c: any) => `Course: ${c.title}`)
              : [];
            const includedChallenges = Array.isArray(plan.challenges)
              ? plan.challenges.map((c: any) => `Challenge: ${c.title}`)
              : [];
            const features = copyList.length
              ? [...copyList, ...includedCourses, ...includedChallenges]
              : [...includedCourses, ...includedChallenges, ...derivedFeatureLines(plan.features)];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 4) * 0.1, duration: 0.4 }}
                className={cn(
                  "relative flex h-full flex-col rounded-3xl p-6 sm:p-8",
                  isHighlighted
                    ? "z-20 border-2 border-primary bg-card shadow-2xl shadow-primary/10 lg:-mt-4 lg:mb-4"
                    : "z-10 border border-border bg-card shadow-[var(--shadow-card)]"
                )}
              >
                {isHighlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg">
                    {plan.highlight_label || "Recommended"}
                  </div>
                )}

                <div className="mb-5">
                  <h3 className="font-display text-2xl font-bold tracking-tight">{plan.name}</h3>
                  {plan.tagline && (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-primary">{plan.tagline}</p>
                  )}
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{plan.description}</p>
                </div>

                <div className="mb-6">
                  {priceValue === 0 ? (
                    <span className="font-display text-5xl font-extrabold">Free</span>
                  ) : (
                    <div className="flex flex-wrap items-baseline gap-1">
                      <span className="text-2xl font-semibold text-muted-foreground">₹</span>
                      <span className="font-display text-5xl font-extrabold tabular-nums tracking-tight">
                        {formatPrice(priceValue)}
                      </span>
                      <span className="ml-1 text-sm font-medium text-muted-foreground">
                        /{isAnnual ? "yr" : "mo"}
                      </span>
                    </div>
                  )}
                  {priceValue > 0 && isAnnual && plan.price_monthly > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Works out to ₹{formatPrice(Math.round(priceValue / 12))}/mo
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={!!loadingPlan || isCurrentPlan}
                  className={cn(
                    "mb-8 w-full rounded-xl py-3.5 text-[15px] font-bold transition-all duration-200",
                    isCurrentPlan
                      ? "cursor-not-allowed border border-success/20 bg-success/10 text-success"
                      : isHighlighted
                        ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg hover:from-orange-600 hover:to-amber-600 hover:shadow-xl"
                        : "border border-border bg-secondary hover:bg-secondary/70"
                  )}
                >
                  {loadingPlan === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" /> Processing…
                    </span>
                  ) : isCurrentPlan ? (
                    "Current plan"
                  ) : priceValue === 0 ? (
                    "Get started free"
                  ) : (
                    "Choose plan"
                  )}
                </button>

                <div className="flex-1">
                  <p className="mb-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    What's included
                  </p>
                  <ul className="space-y-3">
                    {features.map((feature: string, idx: number) => (
                      <li key={`${feature}-${idx}`} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span className="text-sm leading-snug text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Single-course alternative */}
      <div className="relative z-10 mx-auto mt-14 max-w-3xl">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-display text-lg font-bold">Only need one course?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Buy any priced course on its own and keep lifetime access to it — no subscription needed.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/courses")}
            className="w-full shrink-0 rounded-xl border border-primary/30 bg-primary/5 px-6 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
          >
            Browse courses
          </button>
        </div>
      </div>

      {/* Guarantee */}
      <div className="relative z-10 mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <Shield className="h-4 w-4 text-success" /> 7-day money-back guarantee
        </span>
        <span className="inline-flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Cancel anytime
        </span>
        <span className="inline-flex items-center gap-2">
          <Check className="h-4 w-4 text-primary" /> Secure payments via Razorpay
        </span>
      </div>

      {/* FAQ */}
      <div className="relative z-10 mx-auto mb-16 mt-24 max-w-3xl">
        <h2 className="mb-10 text-center font-display text-3xl font-bold">Frequently asked questions</h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div key={idx} className="overflow-hidden rounded-2xl border border-border bg-card">
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                aria-expanded={openFaq === idx}
                className="flex w-full items-center justify-between gap-4 p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
              >
                <span className="font-semibold">{faq.q}</span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300",
                    openFaq === idx && "rotate-180"
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {openFaq === idx && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6 sm:pb-6">
                      {faq.a}
                    </p>
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
