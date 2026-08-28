import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apprenticeshipService } from '@/features/apprenticeship/api/apprenticeship.service';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock, Code2, Users, CheckCircle2, ShieldCheck, Github } from "lucide-react";
import { tracker } from "@/lib/tracker";
import { toast } from "sonner";

export default function ApprenticeshipProgramPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [searchParams] = useSearchParams();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [orderData, setOrderData] = useState<any>(null);
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  const referralCode = useMemo(() => searchParams.get("ref"), [searchParams]);

  useEffect(() => {
    tracker.trackPageView({ page: 'apprenticeship_program_detail', slug });
    return () => tracker.trackTimeOnPage({ page: 'apprenticeship_program_detail', slug });
  }, [slug]);

  useEffect(() => {
    if (referralCode) {
      sessionStorage.setItem("apprenticeship_referral_code", referralCode);
    }
  }, [referralCode]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-apprenticeship", slug],
    queryFn: () => apprenticeshipService.getProgramBySlug(slug!),
    retry: 1
  });

  const program = data?.program;

  const enrollMutation = useMutation({
    mutationFn: (payload: {
      paymentId: string;
      orderId: string;
      signature: string;
    }) => {
      if (!program?.id) {
        throw new Error("Program details are not available");
      }

      return apprenticeshipService.enroll({
        programId: program.id,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        signature: payload.signature,
        referralCode: sessionStorage.getItem("apprenticeship_referral_code"),
        couponCode: couponCode || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Enrollment confirmed");
      navigate("/apprenticeship/dashboard");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to complete enrollment"),
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-5xl space-y-8 animate-pulse">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-24 w-3/4" />
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-32 text-center">
        <h2 className="text-2xl font-bold text-destructive mb-2">Program Not Found</h2>
        <p className="text-muted-foreground mb-6">The apprenticeship you're looking for doesn't exist.</p>
        <Button asChild>
          <Link to="/apprenticeships">Browse Programs</Link>
        </Button>
      </div>
    );
  }

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
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

  const startCheckout = async () => {
    if (!program?.id) {
      toast.error("Program details are not available");
      return;
    }

    if (!isAuthenticated) {
      navigate("/signin");
      return;
    }

    try {
      setLoadingCheckout(true);
      tracker.track("checkout_initiated", { program_id: program.id });
      const order = await apprenticeshipService.createOrder({
        programId: program.id,
        couponCode: couponCode || undefined,
      });
      setOrderData(order);
      setCheckoutOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to create order");
    } finally {
      setLoadingCheckout(false);
    }
  };

  const handlePay = async () => {
    if (!program || !orderData) {
      toast.error("Checkout is not ready yet");
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded) {
      toast.error("Razorpay SDK failed to load. Are you offline?");
      return;
    }

    const razor = new (window as any).Razorpay({
      key: orderData.razorpay_key || import.meta.env.VITE_RAZORPAY_KEY_ID,
      order_id: orderData.order_id,
      amount: orderData.amount,
      currency: "INR",
      name: "Learning Haven",
      description: program.title,
      prefill: {
        name: user?.full_name || "Student",
        email: user?.email || "",
      },
      modal: {
        ondismiss: () => tracker.track("payment_failed", { program_id: program.id }),
      },
      handler: async (response: any) => {
        tracker.track("payment_completed", { program_id: program.id });
        await enrollMutation.mutateAsync({
          paymentId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
        });
      },
    });

    razor.on("payment.failed", () => {
      tracker.track("payment_failed", { program_id: program.id });
    });

    razor.open();
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Hero Banner */}
      <div className="bg-muted/30 border-b border-border/40 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50"></div>
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative z-10">
          <Link to="/apprenticeships" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to programs
          </Link>
          
          <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="bg-background/50 backdrop-blur-sm border-primary/20 text-primary">
                {program.difficulty_level.toUpperCase()}
              </Badge>
              {program.status === 'draft' && (
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-500">COMING SOON</Badge>
              )}
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
              {program.title}
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed">
              {program.description}
            </p>

            <div className="flex items-center gap-6 pt-4 text-sm font-medium text-muted-foreground">
              <div className="flex items-center">
                <Clock className="w-5 h-5 mr-2 text-primary" /> {program.duration_days} Days
              </div>
              <div className="flex items-center">
                <Code2 className="w-5 h-5 mr-2 text-primary" /> {program.projects?.length || 0} Projects
              </div>
              <div className="flex items-center">
                <Users className="w-5 h-5 mr-2 text-primary" /> {program.enrolled_count || 0} Enrolled
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="grid md:grid-cols-3 gap-12 items-start relative">
          
          {/* Main Content */}
          <div className="md:col-span-2 space-y-16">
            
            {/* Tech Stack */}
            <section className="space-y-6">
              <h3 className="text-2xl font-bold border-b border-border/50 pb-2">Tech Stack</h3>
              <div className="flex flex-wrap gap-3">
                {program.tech_stack?.map((tech: string) => (
                  <div key={tech} className="px-4 py-2 rounded-xl bg-card border border-border/50 shadow-sm flex items-center font-medium">
                    <div className="w-2 h-2 rounded-full bg-primary mr-3" />
                    {tech}
                  </div>
                ))}
              </div>
            </section>

            {/* Projects Path */}
            <section className="space-y-6">
              <h3 className="text-2xl font-bold border-b border-border/50 pb-2">The Required Projects</h3>
              <p className="text-muted-foreground leading-relaxed">
                You will build {program.projects?.length} projects from scratch. You cannot access a project until the previous one is successfully verified by our automated CI engine.
              </p>

              <div className="space-y-6 relative before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border/50 before:to-transparent">
                {program.projects?.map((project: any, idx: number) => (
                  <div key={project.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-muted text-muted-foreground shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-[.is-active]:bg-primary group-[.is-active]:text-primary-foreground transition-colors z-10">
                      {idx + 1}
                    </div>
                    
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] p-6 rounded-2xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/30">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="text-xs bg-muted/50">{project.estimated_hours} hrs</Badge>
                        {project.verification_mode === 'automated' && (
                          <div className="flex items-center text-xs text-primary font-medium">
                            <ShieldCheck className="w-3 h-3 mr-1" /> Automated Auth
                          </div>
                        )}
                      </div>
                      <h4 className="font-bold text-lg mb-2">{project.title}</h4>
                      <p className="text-muted-foreground text-sm leading-relaxed mb-4">{project.description}</p>
                      <div className="flex items-center text-xs font-semibold text-muted-foreground bg-muted/30 p-2 rounded-lg gap-2">
                        <Github className="w-4 h-4" /> Sandbox Repo Auto-Provisioned
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sticky Sidebar */}
          <div className="md:col-span-1 md:sticky md:top-24 space-y-6">
            <div className="rounded-3xl border border-primary/20 bg-card p-8 shadow-2xl shadow-primary/5">
              <h3 className="font-bold text-2xl mb-2">Enroll Now</h3>
              <p className="text-muted-foreground text-sm mb-6">Gain immediate access to full specifications and automated reviews.</p>
              
              <div className="mb-6 pb-6 border-b border-border/50">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black">₹{(program.price_inr / 100).toLocaleString('en-IN')}</span>
                  {program.original_price_inr && (
                    <span className="text-lg text-muted-foreground line-through pb-1">
                      ₹{(program.original_price_inr / 100).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                {program.original_price_inr && (
                  <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-transparent">
                    {Math.round(((program.original_price_inr - program.price_inr) / program.original_price_inr) * 100)}% off
                  </Badge>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                  <span className="text-sm font-medium">Automated CI/CD verification for all code</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                  <span className="text-sm font-medium">Earn a Cryptographically verified Certificate</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                  <span className="text-sm font-medium">Reference solutions provided upon completion</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-5 h-5 text-primary mr-3 shrink-0" />
                  <span className="text-sm font-medium">Lifetime access to updates</span>
                </li>
              </ul>

              <Button
                size="lg"
                className="w-full text-base font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all h-14"
                disabled={program.status !== 'active'}
                onClick={startCheckout}
              >
                {loadingCheckout ? "Preparing checkout..." : program.status === 'active' ? 'Start Building Today' : 'Waitlist / Not Available'}
              </Button>
            </div>

          </div>
        </div>
      </div>

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-3xl border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Checkout</h3>
                <p className="text-sm text-muted-foreground">{program.title}</p>
              </div>
              <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>Close</Button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Coupon code</label>
                <div className="flex gap-2">
                  <input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Optional coupon"
                    className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
                  />
                  <Button variant="outline" onClick={startCheckout}>Apply</Button>
                </div>
              </div>

              {orderData ? (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Original</span>
                    <span>₹{(orderData.original_amount / 100).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Discount</span>
                    <span>-₹{((orderData.discount_amount || 0) / 100).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold">
                    <span>Total</span>
                    <span>₹{(orderData.amount / 100).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              ) : null}

              <Button className="w-full" onClick={handlePay} disabled={!orderData || enrollMutation.isPending}>
                Pay with Razorpay
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
