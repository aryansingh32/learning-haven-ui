import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { when } from '../features/security/UserDevices';

interface Overview {
  totals: { devices: number; accounts: number; active_today: number; by_type: Record<string, number> | null };
  sharedDevices: { id: string; os: string | null; browser: string | null; lastIp: string | null; lastSeenAt: string; accounts: { id: string; email: string; name: string | null; role: string }[] }[];
  manyDevices: { id: string; email: string; name: string | null; devices: number; ips: number; lastSeenAt: string }[];
}

/** Devices across Forge: devices shared by several accounts, accounts on many devices. */
export default function Security() {
  const { data, isLoading } = useQuery({ queryKey: ['security-devices'], queryFn: async () => (await api.get<Overview>('/admin/security/devices')).data });
  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  const t = data.totals;
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Security</h2>
        <p className="text-muted-foreground">Devices and network addresses across all accounts. Open a user for their devices and sign-ins.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[['Devices recorded', t.devices], ['Accounts with a device', t.accounts], ['Devices active today', t.active_today]].map(([label, n]) => (
          <Card key={label as string}><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold tabular-nums">{n as number}</p></CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldAlert className="h-4 w-4 text-destructive" />Devices shared by several accounts ({data.sharedDevices.length})</CardTitle>
          <CardDescription>One browser signed in to more than one account: shared logins, test impersonation, or a shared family/lab computer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.sharedDevices.length === 0 && <p className="text-sm text-muted-foreground">None.</p>}
          {data.sharedDevices.map((d) => (
            <div key={d.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{[d.browser, d.os].filter(Boolean).join(' · ') || 'Unknown device'}</span>
                <span className="font-mono text-xs text-muted-foreground">{d.id}… · {d.lastIp ?? '—'}</span>
                <Badge variant="destructive">{d.accounts.length} accounts</Badge>
                <span className="ml-auto text-xs text-muted-foreground">last seen {when(d.lastSeenAt)}</span>
              </div>
              <p className="mt-1 text-xs">{d.accounts.map((a, i) => (
                <span key={a.id}>{i > 0 && ', '}<Link className="underline" to={`/users/${a.id}`}>{a.name || a.email}</Link>{a.role !== 'user' && <span className="text-muted-foreground"> ({a.role})</span>}</span>
              ))}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Accounts on many devices (30 days)</CardTitle>
          <CardDescription>Five or more devices in a month can mean a shared or sold login.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.manyDevices.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">Account</th><th className="text-right font-medium">Devices</th><th className="text-right font-medium">IPs</th><th className="text-right font-medium">Last seen</th></tr></thead>
              <tbody>{data.manyDevices.map((a) => (
                <tr key={a.id} className="border-b last:border-0"><td className="py-1.5"><Link className="underline" to={`/users/${a.id}`}>{a.name || a.email}</Link></td><td className="text-right tabular-nums">{a.devices}</td><td className="text-right tabular-nums">{a.ips}</td><td className="text-right text-xs">{when(a.lastSeenAt)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
