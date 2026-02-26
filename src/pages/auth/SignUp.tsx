import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/auth.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SignUp() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [authMethod, setAuthMethod] = useState<"email" | "phone">("phone");
    const [loading, setLoading] = useState(false);

    // Email state
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Phone state
    const [phoneStep, setPhoneStep] = useState<1 | 2 | 3>(1);
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [verificationId, setVerificationId] = useState("");
    const [countdown, setCountdown] = useState(30);
    const [college, setCollege] = useState("");

    // OTP Countdown
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (phoneStep === 2 && countdown > 0) {
            timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [phoneStep, countdown]);

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ full_name: name, email, password });
            toast.success("Account created successfully!");
            navigate("/onboarding");
        } catch (error: any) {
            toast.error(error.message || "Failed to create account");
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (phone.length !== 10) return;
        setLoading(true);
        try {
            await authService.phoneSendOtp(phone);
            setPhoneStep(2);
            setCountdown(30);
            toast.success("OTP sent to your phone");
        } catch (error: any) {
            // PostgREST errors are deeply nested sometimes
            const msg = error.response?.data?.error || error.message || "Failed to send OTP";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (currentOtp?: string) => {
        const otpValue = currentOtp || otp;
        if (otpValue.length !== 6) return;
        setLoading(true);
        try {
            const res: any = await authService.phoneVerifyOtp(phone, otpValue);

            if (res.isNewUser) {
                setVerificationId(res.verification_id);
                setPhoneStep(3);
                toast.success("Phone verified. Let's finish setting up!");
            } else {
                localStorage.setItem("auth_token", res.token);
                // Force reload or Context refresh to load user session
                navigate("/onboarding");
                window.location.reload();
            }
        } catch (error: any) {
            const msg = error.response?.data?.error || "Invalid OTP";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleCompleteProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) {
            toast.error("Name is required");
            return;
        }
        setLoading(true);
        try {
            const onboardingAnswersStr = localStorage.getItem('dsa_os_onboarding');
            const answers = onboardingAnswersStr ? JSON.parse(onboardingAnswersStr) : null;

            const res: any = await authService.phoneCompleteProfile({
                phone,
                verification_id: verificationId,
                name,
                college_name: college,
                onboarding_answers: answers
            });

            localStorage.setItem("auth_token", res.token);
            toast.success("Welcome aboard!");
            navigate("/onboarding");
            window.location.reload();
        } catch (error: any) {
            const msg = error.response?.data?.error || "Failed to complete profile";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="card-glass border-border/40 shadow-lg w-full max-w-md mx-auto mt-10">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl font-bold">Sign Up</CardTitle>
                <CardDescription>Begin your learning journey</CardDescription>

                {phoneStep === 1 && (
                    <div className="flex p-1 bg-gray-100 rounded-lg mt-4 w-full">
                        <button
                            type="button"
                            onClick={() => setAuthMethod("phone")}
                            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${authMethod === "phone" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Phone
                        </button>
                        <button
                            type="button"
                            onClick={() => setAuthMethod("email")}
                            className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${authMethod === "email" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                        >
                            Email
                        </button>
                    </div>
                )}
            </CardHeader>

            <CardContent>
                {authMethod === "email" ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" type="text" placeholder="Rahul S" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign Up via Email"}
                        </Button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        {phoneStep === 1 && (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <div className="flex items-center ring-1 ring-border rounded-md focus-within:ring-ring focus-within:ring-2">
                                        <div className="px-3 text-gray-500 font-medium">+91</div>
                                        <input
                                            id="phone"
                                            type="tel"
                                            placeholder="9876543210"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                            className="flex-1 h-10 bg-transparent border-0 focus:ring-0 outline-none px-2"
                                            required
                                        />
                                    </div>
                                </div>
                                <Button type="submit" className="w-full" disabled={loading || phone.length !== 10}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Send OTP"}
                                </Button>
                            </form>
                        )}

                        {phoneStep === 2 && (
                            <div className="space-y-6 flex flex-col items-center">
                                <p className="text-sm text-center text-gray-600">
                                    Enter the 6-digit code sent to <br /><span className="font-semibold">+91 {phone}</span>
                                </p>

                                <InputOTP
                                    maxLength={6}
                                    value={otp}
                                    onChange={(v) => {
                                        setOtp(v);
                                        if (v.length === 6) handleVerifyOtp(v);
                                    }}
                                    disabled={loading}
                                >
                                    <InputOTPGroup>
                                        <InputOTPSlot index={0} />
                                        <InputOTPSlot index={1} />
                                        <InputOTPSlot index={2} />
                                    </InputOTPGroup>
                                    <InputOTPSeparator />
                                    <InputOTPGroup>
                                        <InputOTPSlot index={3} />
                                        <InputOTPSlot index={4} />
                                        <InputOTPSlot index={5} />
                                    </InputOTPGroup>
                                </InputOTP>

                                <div className="text-center w-full">
                                    <Button
                                        variant="ghost"
                                        className="text-sm"
                                        disabled={countdown > 0 || loading}
                                        onClick={() => handleSendOtp()}
                                    >
                                        {countdown > 0 ? `Resend OTP in ${countdown}s` : "Resend OTP"}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {phoneStep === 3 && (
                            <form onSubmit={handleCompleteProfile} className="space-y-4">
                                <div className="text-center mb-4">
                                    <p className="text-sm text-gray-500">Just a few more details to set up your profile.</p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name</Label>
                                    <Input id="name" placeholder="Rahul Sharma" value={name} onChange={e => setName(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="college">College Name <span className="text-gray-400 font-normal">(Optional)</span></Label>
                                    <Input id="college" placeholder="IIT Bombay" value={college} onChange={e => setCollege(e.target.value)} />
                                </div>
                                <Button type="submit" className="w-full mt-2" disabled={loading}>
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Complete Setup"}
                                </Button>
                            </form>
                        )}
                    </div>
                )}
            </CardContent>

            {(phoneStep === 1 || authMethod === "email") && (
                <CardFooter className="flex justify-center border-t border-border/40 pt-4">
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link to="/signin" className="text-primary hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </CardFooter>
            )}
        </Card>
    );
}
