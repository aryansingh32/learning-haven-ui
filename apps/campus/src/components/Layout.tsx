import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { BookOpenCheck, ClipboardList, LayoutDashboard, LogOut, Menu, Settings, Users, UsersRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@/api/types';
import { ROLE_LABEL } from '@/api/types';
import { useBrandColor, useCampus, useOrg } from '@/context/CampusContext';
import { cn } from '@/lib/utils';

const NAV: Array<{ to: string; label: string; icon: LucideIcon; needs?: Permission }> = [
  { to: 'overview', label: 'Overview', icon: LayoutDashboard },
  { to: 'assignments', label: 'Assignments', icon: ClipboardList, needs: 'assessments.create' },
  { to: 'tests', label: 'Tests', icon: BookOpenCheck, needs: 'content.create' },
  { to: 'batches', label: 'Batches', icon: UsersRound, needs: 'members.view' },
  { to: 'people', label: 'People', icon: Users, needs: 'members.view' },
  { to: 'settings', label: 'Settings', icon: Settings, needs: 'org.manage' },
];

export default function Layout() {
  const { orgId } = useParams();
  const { staffOrgs, session, signOut, me } = useCampus();
  const { membership, can } = useOrg(orgId);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  useBrandColor(membership?.brandColor);

  if (!membership) return null;

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Main">
      {NAV.filter((n) => !n.needs || can(n.needs)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={`/o/${orgId}/${to}`}
          onClick={() => setOpen(false)}
          className={({ isActive }) => cn(
            'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </NavLink>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center gap-3">
          {membership.logoUrl
            ? <img src={membership.logoUrl} alt="" className="h-9 w-9 rounded-md object-contain" />
            : <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">{membership.orgName.slice(0, 2).toUpperCase()}</div>}
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-semibold leading-snug">{membership.orgName}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABEL[membership.role]}</p>
          </div>
        </div>
        {staffOrgs.length > 1 && (
          <select
            aria-label="Switch college"
            className="mt-3 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            value={orgId}
            onChange={(e) => navigate(`/o/${e.target.value}/overview`)}
          >
            {staffOrgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.orgName}</option>)}
          </select>
        )}
      </div>
      {nav}
      <div className="border-t p-3">
        {me?.isPlatformAdmin && (
          <NavLink to="/platform" className="mb-1 block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">All colleges</NavLink>
        )}
        <p className="truncate px-3 text-xs text-muted-foreground">{session?.email}</p>
        <button onClick={signOut} className="mt-1 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r bg-card md:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-card shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <button onClick={() => setOpen((v) => !v)} aria-label={open ? 'Close menu' : 'Open menu'} className="rounded-md p-1.5 hover:bg-accent">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="truncate text-sm font-semibold">{membership.orgName}</p>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
