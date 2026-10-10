import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MailWarning, Loader2, X } from 'lucide-react';
import { accountApi } from './account.service';

/** Shown across the app while the learner's email isn't confirmed (slice W2-A1). */
export function EmailVerifyBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('verify-banner-hidden') === '1'; } catch { return false; }
  });
  const info = useQuery({ queryKey: ['account-info'], queryFn: accountApi.info, retry: false, staleTime: 60_000 });
  const send = useMutation({
    mutationFn: accountApi.sendVerification,
    onSuccess: (r) => toast.success(`Verification email sent to ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });
  if (hidden || !info.data || info.data.email_verified) return null;
  return (
    <div role="status" aria-label="Email not verified"
      className="mb-4 flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm sm:flex-row sm:items-center">
      <MailWarning className="hidden h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300 sm:block" aria-hidden />
      <p className="flex-1 text-foreground">
        <strong>Confirm your email</strong> <span className="break-all">({info.data.email})</span> to pay for plans, earn certificates and publish your portfolio.
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => send.mutate()} disabled={send.isPending}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {send.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Resend email
        </button>
        <Link to="/settings/account" className="text-xs font-semibold text-amber-700 underline dark:text-amber-300">Details</Link>
        <button type="button" aria-label="Hide for now" className="rounded p-1 text-muted-foreground hover:text-foreground"
          onClick={() => { setHidden(true); try { sessionStorage.setItem('verify-banner-hidden', '1'); } catch { /* ignore */ } }}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
