import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { persistSession } from '@/lib/authSession';
import { accountApi } from '@/features/account/account.service';

/**
 * /verify-email — "check your inbox" after sign-up (with resend), and where the
 * confirmation link lands: Supabase appends the new session in the URL hash.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [confirmed, setConfirmed] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access = hash.get('access_token');
    if (access) {
      persistSession({ access_token: access, refresh_token: hash.get('refresh_token') ?? '' });
      setConfirmed(true);
      window.history.replaceState(null, '', window.location.pathname);
    } else if (hash.get('error_description')) {
      setLinkError(hash.get('error_description'));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const resend = useMutation({
    mutationFn: () => accountApi.resendPublic(email.trim()),
    onSuccess: () => toast.success('If that address has an account waiting for confirmation, a new link is on its way.'),
    onError: (e: Error) => toast.error(e.message),
  });

  if (confirmed) {
    return (
      <Card className="card-glass border-border/40 shadow-lg w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <BadgeCheck className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
          <CardTitle className="text-2xl font-bold">Email confirmed</CardTitle>
          <CardDescription>You're signed in. Everything on Forge is open to you now.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          {/* A full load so the app picks up the new session. */}
          <Button onClick={() => window.location.assign('/dashboard')}>Continue</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glass border-border/40 shadow-lg w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <CardTitle className="text-2xl font-bold">Check your inbox</CardTitle>
        <CardDescription>
          {linkError
            ? `That link didn't work (${linkError}). Ask for a new one below.`
            : 'We sent you a link to confirm your email. Open it on this device to finish signing up.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); resend.mutate(); }}>
          <div className="space-y-1.5">
            <Label htmlFor="verify-email">Email</Label>
            <Input id="verify-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <Button type="submit" className="w-full" disabled={resend.isPending || !email.trim()}>
            {resend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send the link again
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Can't find it? Check spam or promotions. Already confirmed? <Link to="/signin" className="text-primary hover:underline">Sign in</Link>
        </p>
      </CardContent>
    </Card>
  );
}
