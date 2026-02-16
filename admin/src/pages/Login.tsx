import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { Loader2, Zap, Lock, Mail } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login({ email, password });
            navigate('/');
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen relative overflow-hidden"
            style={{
                background: 'linear-gradient(135deg, hsl(224 71% 4%) 0%, hsl(234 50% 12%) 50%, hsl(258 40% 10%) 100%)',
            }}
        >
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, hsl(234 89% 63% / 0.15), transparent 70%)' }}
                />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-8"
                    style={{ background: 'radial-gradient(circle, hsl(258 90% 66% / 0.12), transparent 70%)' }}
                />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
                    style={{ background: 'radial-gradient(circle, hsl(234 89% 63% / 0.05), transparent 70%)' }}
                />
            </div>

            <div className="relative z-10 w-full max-w-md px-4 animate-fade-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
                        <Zap className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Learning Haven</h1>
                    <p className="text-sm text-gray-400 mt-1">Admin Control Panel</p>
                </div>

                <Card className="border-0 shadow-2xl"
                    style={{
                        background: 'hsl(225 45% 8% / 0.8)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid hsl(216 34% 17% / 0.5)',
                    }}
                >
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm text-gray-300">Email Address</Label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm text-gray-300">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                    {error}
                                </div>
                            )}

                            <Button
                                className="w-full h-11 gradient-primary hover:opacity-90 transition-opacity text-white font-semibold shadow-lg shadow-primary/25"
                                type="submit"
                                disabled={loading}
                            >
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </form>

                        <div className="mt-6 pt-5 border-t border-white/5 text-center">
                            <p className="text-xs text-gray-500">
                                Secured admin access · Only authorized personnel
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Login;
