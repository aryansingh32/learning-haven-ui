import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Laptop, Loader2, Smartphone, Tablet, Users } from 'lucide-react';
import api from '../../services/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface DeviceRow {
  id: string; label: string; os: string | null; osVersion: string | null; browser: string | null; browserVersion: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet' | null; screen: string | null; screens: number | null; timezone: string | null;
  language: string | null; lastIp: string | null; ips: string[]; firstSeenAt: string; lastSeenAt: string; seenCount: number;
  sharedWith: { id: string; email: string; name: string | null }[];
}
interface Response { devices: DeviceRow[]; signIns: { at: string; ip: string | null; device: string; method: string | null }[] }

export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const DeviceIcon = ({ type }: { type: DeviceRow['deviceType'] }) =>
  type === 'mobile' ? <Smartphone className="h-4 w-4" aria-hidden /> : type === 'tablet' ? <Tablet className="h-4 w-4" aria-hidden /> : <Laptop className="h-4 w-4" aria-hidden />;

/** Every device this account was used from, its IPs, and its recent sign-ins. */
export function UserDevices({ userId }: { userId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-devices', userId],
    queryFn: async () => (await api.get<Response>(`/admin/users/${userId}/devices`)).data,
  });
  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (error || !data) return <p className="text-sm text-destructive">Could not load devices.</p>;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devices ({data.devices.length})</CardTitle>
          <CardDescription>Browsers this account was used from, with the network addresses they came from. A device used by other accounts is marked.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.devices.length === 0 && <p className="text-sm text-muted-foreground">No devices recorded yet (recorded from the next sign-in on an updated app).</p>}
          {data.devices.map((d) => (
            <div key={d.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <DeviceIcon type={d.deviceType} />
                <span className="font-medium">{d.label}</span>
                {d.screens && d.screens > 1 && <Badge variant="outline">{d.screens} screens</Badge>}
                {d.sharedWith.length > 0 && <Badge variant="destructive" className="gap-1"><Users className="h-3 w-3" />Shared with {d.sharedWith.length}</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">last seen {when(d.lastSeenAt)}</span>
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                <div><dt className="inline font-medium text-foreground">IP </dt><dd className="inline font-mono">{d.lastIp ?? '—'}</dd>{d.ips.length > 1 && <span> (+{d.ips.length - 1} more)</span>}</div>
                <div><dt className="inline font-medium text-foreground">Screen </dt><dd className="inline">{d.screen ?? '—'}</dd></div>
                <div><dt className="inline font-medium text-foreground">Timezone </dt><dd className="inline">{d.timezone ?? '—'}</dd></div>
                <div><dt className="inline font-medium text-foreground">First seen </dt><dd className="inline">{when(d.firstSeenAt)}</dd></div>
                <div><dt className="inline font-medium text-foreground">Device id </dt><dd className="inline font-mono">{d.id}…</dd></div>
                <div><dt className="inline font-medium text-foreground">Requests </dt><dd className="inline">{d.seenCount}</dd></div>
              </dl>
              {d.ips.length > 1 && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{d.ips.join(', ')}</p>}
              {d.sharedWith.length > 0 && (
                <p className="mt-1 text-xs">Also used by: {d.sharedWith.map((u, i) => (
                  <span key={u.id}>{i > 0 && ', '}<Link className="underline" to={`/users/${u.id}`}>{u.name || u.email}</Link></span>
                ))}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Recent sign-ins</CardTitle></CardHeader>
        <CardContent>
          {data.signIns.length === 0 ? <p className="text-sm text-muted-foreground">None recorded.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3 font-medium">When</th><th className="pr-3 font-medium">Device</th><th className="pr-3 font-medium">IP</th><th className="font-medium">Method</th></tr></thead>
                <tbody>{data.signIns.map((s, i) => (
                  <tr key={i} className="border-b last:border-0"><td className="py-1.5 pr-3 whitespace-nowrap">{when(s.at)}</td><td className="pr-3">{s.device}</td><td className="pr-3 font-mono text-xs">{s.ip ?? '—'}</td><td>{s.method ?? '—'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
