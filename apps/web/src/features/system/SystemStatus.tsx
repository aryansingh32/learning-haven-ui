import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, Info, Megaphone, ShieldOff, Wrench, X } from 'lucide-react';
import api from '@/services/api.svc';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { onSystemEvent } from './systemEvents';

/**
 * What the admin control centre says right now, for this learner: maintenance
 * mode, whether sign-ups are open, feature flags and announcements. Polled from
 * GET /api/system/status, and updated at once when an API response reports
 * maintenance or a suspended account.
 */

export interface SystemAnnouncement {
  id: string; title: string; body: string; level: 'info' | 'warning' | 'critical'; linkUrl: string | null; linkLabel: string | null; endsAt: string | null;
}
export interface SystemStatus {
  maintenance: { on: boolean; message: string };
  signupsOpen: boolean;
  flags: Record<string, boolean>;
  announcements: SystemAnnouncement[];
}

const FALLBACK: SystemStatus = { maintenance: { on: false, message: '' }, signupsOpen: true, flags: {}, announcements: [] };
const Ctx = createContext<SystemStatus>(FALLBACK);

/** The control centre's state; everything on until it has loaded. */
export const useSystemStatus = () => useContext(Ctx);

/** Whether a feature flag is on for this learner (off when unknown). */
export const useFeatureFlag = (key: string) => Boolean(useContext(Ctx).flags[key]);

// Full-screen pages (exams, the coding workspace, invoices) don't get banners.
const NO_BANNER = [/^\/college\/tests\//, /^\/test-series\/tests\//, /^\/problems\//, /\/workspace$/, /^\/billing\/invoices\//];
const DISMISSED_KEY = 'forge:dismissed-announcements';

function readDismissed(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-50) : [];
  } catch {
    return [];
  }
}

export function SystemStatusProvider({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'super_admin';
  const { data, refetch } = useQuery({
    queryKey: ['system-status', user?.id ?? null],
    queryFn: async () => (await api.get('/system/status')) as unknown as SystemStatus,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
    staleTime: 30_000,
  });
  const status = data ?? FALLBACK;
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [suspended, setSuspended] = useState<string | null>(null);

  useEffect(() => onSystemEvent((e) => {
    if (e.type === 'maintenance') { setMaintenanceMessage(e.message); void refetch(); }
    if (e.type === 'suspended') setSuspended(e.message);
  }), [refetch]);

  // A status that says maintenance is over ends a maintenance screen raised by an API error.
  useEffect(() => { if (data && !data.maintenance.on) setMaintenanceMessage(null); }, [data]);

  const { pathname } = useLocation();
  // Signing in stays open, so staff can get past the maintenance screen.
  const maintenanceOn = !isStaff && pathname !== '/signin' && (status.maintenance.on || maintenanceMessage !== null);

  if (suspended) {
    return (
      <FullScreen icon={<ShieldOff className="h-10 w-10 text-destructive" />} title="Your account is suspended">
        <p>{suspended}</p>
        <Button className="mt-6" variant="outline" onClick={() => { setSuspended(null); logout(); }}>Sign out</Button>
      </FullScreen>
    );
  }
  if (maintenanceOn) {
    return (
      <FullScreen icon={<Wrench className="h-10 w-10 text-primary" />} title="Back shortly">
        <p>{status.maintenance.message || maintenanceMessage || "We're making Forge better. Back shortly."}</p>
        <Button className="mt-6" variant="outline" onClick={() => void refetch()}>Try again</Button>
      </FullScreen>
    );
  }
  return (
    <Ctx.Provider value={status}>
      {isStaff && status.maintenance.on && (
        <div role="status" className="bg-destructive px-4 py-1.5 text-center text-xs font-medium text-destructive-foreground">
          Maintenance mode is on: learners see the maintenance screen. You can keep working.
        </div>
      )}
      <AnnouncementBar items={status.announcements} />
      {children}
    </Ctx.Provider>
  );
}

function FullScreen({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center text-muted-foreground">
        <div className="mb-4 flex justify-center">{icon}</div>
        <h1 className="mb-2 text-2xl font-semibold text-foreground">{title}</h1>
        {children}
      </div>
    </main>
  );
}

const LEVEL = {
  info: { cls: 'bg-primary/10 text-foreground border-primary/20', icon: Info },
  warning: { cls: 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/60 dark:text-amber-100 dark:border-amber-800', icon: Megaphone },
  critical: { cls: 'bg-destructive text-destructive-foreground border-destructive', icon: AlertTriangle },
};

function AnnouncementBar({ items }: { items: SystemAnnouncement[] }) {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  if (NO_BANNER.some((re) => re.test(pathname))) return null;
  // Critical announcements can't be dismissed.
  const visible = items.filter((a) => a.level === 'critical' || !dismissed.includes(a.id)).slice(0, 3);
  if (!visible.length) return null;
  const dismiss = (id: string) => {
    const next = [...dismissed, id].slice(-50);
    setDismissed(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* private mode: dismissed for this visit */ }
  };
  return (
    <div aria-label="Announcements">
      {visible.map((a) => {
        const { cls, icon: Icon } = LEVEL[a.level];
        return (
          <div key={a.id} role={a.level === 'critical' ? 'alert' : 'status'} className={`flex items-start gap-2 border-b px-4 py-2 text-sm ${cls}`}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="flex-1">
              <span className="font-semibold">{a.title}</span>
              {a.body && <span> — {a.body}</span>}
              {a.linkUrl && <> <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">{a.linkLabel || 'Learn more'}</a></>}
            </p>
            {a.level !== 'critical' && (
              <button type="button" onClick={() => dismiss(a.id)} aria-label={`Dismiss: ${a.title}`} className="rounded p-0.5 opacity-70 hover:opacity-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
