import { useEffect, useState, type FormEvent } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { signIn } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, Field, ErrorNote, Loading } from '@/components/common';
import { useBrandColor, useCampus } from '@/context/CampusContext';

export default function Login() {
  const { hostSlug, hostCollege } = useCampus();
  useBrandColor(hostCollege?.brandColor);
  useEffect(() => {
    document.title = hostCollege ? `${hostCollege.name} · Forge Campus` : 'Forge Campus';
  }, [hostCollege]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (hostSlug && hostCollege === undefined) return <Loading />;
  if (hostSlug && hostCollege === null) {
    return (
      <main className="mx-auto max-w-lg px-4 py-24">
        <EmptyState title="No college at this address">
          Check the address with your college. If it is right, the college may not be active on Forge Campus right now.
        </EmptyState>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          {hostCollege?.logoUrl
            ? <img src={hostCollege.logoUrl} alt="" className="h-9 w-9 rounded-lg object-contain" />
            : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="h-5 w-5" />
              </div>
            )}
          <div>
            <p className="font-semibold leading-tight">{hostCollege?.name ?? 'Forge Campus'}</p>
            <p className="text-xs text-muted-foreground">{hostCollege ? 'Staff workspace on Forge Campus' : 'For college staff'}</p>
          </div>
        </div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hostCollege ? `Use your Forge account. ${hostCollege.name}'s Campus admin adds staff.` : 'Use your Forge account. Your college admin adds staff to Campus.'}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" htmlFor="password">
            <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error ? <ErrorNote error={error} /> : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
