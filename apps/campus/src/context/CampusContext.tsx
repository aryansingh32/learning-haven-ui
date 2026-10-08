import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, loadSession, onSessionChange, signOut as clearSession, type Session } from '@/api/client';
import type { Me, Membership, Permission } from '@/api/types';

interface CampusState {
  session: Session | null;
  me: Me | undefined;
  loadingMe: boolean;
  /** Colleges where this person has any staff permission. */
  staffOrgs: Membership[];
  signOut: () => void;
}

const CampusContext = createContext<CampusState | null>(null);

export function CampusProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession());
  const queryClient = useQueryClient();

  useEffect(() => onSessionChange((s) => {
    setSession(s);
    if (!s) queryClient.clear();
  }), [queryClient]);

  const meQuery = useQuery({
    queryKey: ['me', session?.email],
    queryFn: () => api<Me>('/me'),
    enabled: Boolean(session),
    staleTime: 60_000,
  });

  const value = useMemo<CampusState>(() => ({
    session,
    me: meQuery.data,
    loadingMe: meQuery.isLoading,
    staffOrgs: (meQuery.data?.memberships ?? []).filter((m) => m.type === 'college' && m.permissions.length > 0),
    signOut: clearSession,
  }), [session, meQuery.data, meQuery.isLoading]);

  return <CampusContext.Provider value={value}>{children}</CampusContext.Provider>;
}

export function useCampus() {
  const ctx = useContext(CampusContext);
  if (!ctx) throw new Error('useCampus must be used inside CampusProvider');
  return ctx;
}

/** The college currently open in the portal, its permissions and a `can()` check. */
export function useOrg(orgId: string | undefined) {
  const { staffOrgs } = useCampus();
  const membership = staffOrgs.find((m) => m.orgId === orgId);
  const can = (p: Permission) => Boolean(membership?.permissions.includes(p));
  return { membership, can };
}

/** Apply a college's brand colour to the accent tokens. */
export function useBrandColor(color: string | null | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) root.style.setProperty('--brand', color);
    else root.style.removeProperty('--brand');
    return () => {
      root.style.removeProperty('--brand');
    };
  }, [color]);
}
