/**
 * EntitlementService — Abstract premium access checks.
 *
 * Replaces hardcoded boolean checks like `user.is_premium` with a
 * dynamic, server-driven entitlement system.
 *
 * ARCHITECTURE:
 * - Fetches entitlements from `/users/me/entitlements` (or derives from existing data)
 * - Exposes `can()` / `has()` checks for features, content, and limits
 * - Falls back gracefully when the backend doesn't yet have the endpoint
 * - Admin-controllable: entitlements come from plan/product ownership
 *
 * DOES NOT break existing premium checks — wraps them.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useApiQuery } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';

// ─── Entitlement Feature Keys ───────────────────────────────────────────────

export type EntitlementFeature =
  | 'ai_unlimited'
  | 'ai_basic'
  | 'premium_chapters'
  | 'premium_challenges'
  | 'premium_projects'
  | 'premium_certificates'
  | 'career_insights'
  | 'advanced_analytics'
  | 'resume_builder'
  | 'mock_interviews'
  | 'priority_support'
  | 'mentor_access'
  | 'job_board_premium';

export type EntitlementTier = 'free' | 'pro' | 'career_accelerator' | 'enterprise';

export type UserEntitlements = {
  tier: EntitlementTier;
  features: EntitlementFeature[];
  limits: {
    ai_queries_per_day: number;
    ai_queries_remaining: number;
    projects_available: number;
    certificates_available: number;
  };
  products_owned: string[];   // product IDs
  plan_id: string | null;
  plan_name: string | null;
  expires_at: string | null;
};

type EntitlementContextValue = {
  /** Check if user has a specific feature */
  can: (feature: EntitlementFeature) => boolean;
  /** Check if user owns a specific product by ID */
  owns: (productId: string) => boolean;
  /** Get the user's current tier */
  tier: EntitlementTier;
  /** Get specific limit value */
  limit: (key: keyof UserEntitlements['limits']) => number;
  /** Whether user is on any paid plan */
  isPaid: boolean;
  /** Full entitlements data */
  entitlements: UserEntitlements;
  /** Loading state */
  isLoading: boolean;
};

// ─── Default (Free Tier) ────────────────────────────────────────────────────

const FREE_ENTITLEMENTS: UserEntitlements = {
  tier: 'free',
  features: ['ai_basic', 'resume_builder'],
  limits: {
    ai_queries_per_day: 10,
    ai_queries_remaining: 10,
    projects_available: 2,
    certificates_available: 0,
  },
  products_owned: [],
  plan_id: null,
  plan_name: 'Free',
  expires_at: null,
};

const EntitlementContext = createContext<EntitlementContextValue>({
  can: () => false,
  owns: () => false,
  tier: 'free',
  limit: () => 0,
  isPaid: false,
  entitlements: FREE_ENTITLEMENTS,
  isLoading: true,
});

/**
 * Derive entitlements from existing user data.
 * This gracefully handles the case where the backend doesn't yet
 * have a dedicated /entitlements endpoint.
 */
function deriveEntitlements(
  backendData: any | undefined,
  user: any | undefined,
  usage: any | undefined
): UserEntitlements {
  // If backend provides entitlements map from /entitlements/map
  if (backendData && backendData._plan) {
    const plan = backendData._plan;
    const tier = (plan.slug === 'career_accelerator' ? 'career_accelerator' : plan.slug === 'pro' ? 'pro' : plan.slug === 'path_pack' ? 'pro' : 'free') as EntitlementTier;
    
    const features: EntitlementFeature[] = [];
    
    if (backendData.ai_queries_per_day?.allowed) {
      features.push('ai_basic');
      if (backendData.ai_queries_per_day.limit === -1) {
        features.push('ai_unlimited');
      }
    }
    if (backendData.career_paths_access?.allowed) {
      features.push('premium_chapters');
      features.push('premium_projects');
      features.push('career_insights');
    }
    if (backendData.certificates_access?.allowed) {
      features.push('premium_certificates');
    }
    if (backendData.resume_builder_access?.allowed) {
      features.push('resume_builder');
    }
    if (backendData.mock_interviews_count?.allowed) {
      features.push('mock_interviews');
    }
    if (backendData.placement_support_access?.allowed) {
      features.push('job_board_premium');
    }
    if (backendData.analytics_advanced?.allowed) {
      features.push('advanced_analytics');
    }
    if (backendData.priority_support?.allowed) {
      features.push('priority_support');
    }
    
    const limits = {
      ai_queries_per_day: backendData.ai_queries_per_day?.limit ?? 5,
      ai_queries_remaining: backendData.ai_queries_per_day?.remaining ?? 5,
      projects_available: backendData.career_paths_access?.allowed ? 99 : 2,
      certificates_available: backendData.certificates_access?.allowed ? 99 : 0,
    };

    return {
      tier,
      features,
      limits,
      products_owned: [],
      plan_id: plan.slug,
      plan_name: plan.name,
      expires_at: plan.periodEnd || null,
    };
  }

  // If backend provides full entitlements, use them directly
  if (backendData?.tier && backendData?.features) {
    return backendData as UserEntitlements;
  }

  // Derive from existing user data (backward compatible)
  const isPremium = user?.is_premium || user?.status === 'premium' || false;

  if (isPremium) {
    return {
      tier: 'pro',
      features: [
        'ai_unlimited', 'ai_basic',
        'premium_chapters', 'premium_challenges', 'premium_projects',
        'premium_certificates', 'career_insights', 'advanced_analytics',
        'resume_builder', 'mentor_access',
      ],
      limits: {
        ai_queries_per_day: 999,
        ai_queries_remaining: usage?.remaining ?? 999,
        projects_available: 99,
        certificates_available: 99,
      },
      products_owned: [],
      plan_id: 'pro',
      plan_name: 'Pro',
      expires_at: user?.premium_expires_at || null,
    };
  }

  // Free tier
  return {
    ...FREE_ENTITLEMENTS,
    limits: {
      ...FREE_ENTITLEMENTS.limits,
      ai_queries_remaining: usage?.remaining ?? FREE_ENTITLEMENTS.limits.ai_queries_per_day,
    },
  };
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Try to fetch dedicated entitlements endpoint (graceful 404 fallback)
  const { data: backendEntitlements, isLoading: entLoading } = useApiQuery<any>(
    ['user-entitlements'],
    '/entitlements/map',
    { retry: false, staleTime: 60_000 },
  );

  // Also fetch AI usage for limit data
  const { data: usage } = useApiQuery<any>(
    ['ai-usage'],
    '/ai/usage',
    { staleTime: 30_000 },
  );

  const value = useMemo<EntitlementContextValue>(() => {
    const entitlements = deriveEntitlements(backendEntitlements, user, usage);

    return {
      can: (feature: EntitlementFeature) => entitlements.features.includes(feature),
      owns: (productId: string) => entitlements.products_owned.includes(productId),
      tier: entitlements.tier,
      limit: (key: keyof UserEntitlements['limits']) => entitlements.limits[key],
      isPaid: entitlements.tier !== 'free',
      entitlements,
      isLoading: entLoading,
    };
  }, [backendEntitlements, user, usage, entLoading]);

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

/** Hook to check user entitlements */
export const useEntitlements = () => useContext(EntitlementContext);

/**
 * Premium gate component — wraps content that requires a specific feature.
 * Shows upgrade prompt when the user doesn't have access.
 */
export function PremiumGate({
  feature,
  children,
  fallback,
}: {
  feature: EntitlementFeature;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { can } = useEntitlements();

  if (can(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  return (
    <div className="rounded-2xl border border-dashed border-purple-500/30 bg-purple-500/5 p-6 text-center">
      <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center mb-3 shadow-lg">
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <p className="text-sm font-bold text-foreground mb-1">Premium Feature</p>
      <p className="text-xs text-muted-foreground mb-4">
        Upgrade to Pro to unlock this feature and accelerate your career.
      </p>
      <a
        href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm font-bold shadow-lg hover:-translate-y-0.5 transition-all"
      >
        Upgrade to Pro
      </a>
    </div>
  );
}
