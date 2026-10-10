import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api.svc';

export type ReadinessKey = 'practice' | 'assessments' | 'learning' | 'projects' | 'profile' | 'consistency';
export interface Readiness {
  score: number;
  level: 'Getting started' | 'Building up' | 'Interview-ready' | 'Placement-ready';
  parts: Array<{ key: ReadinessKey; label: string; weight: number; score: number; detail: string; next: { label: string; link: string } | null }>;
  weakTopics: string[];
  nextSteps: Array<{ label: string; link: string; gain: number }>;
  history: Array<{ day: string; score: number }>;
}

export const READINESS_KEY = ['my-readiness'];
export const fetchReadiness = (): Promise<Readiness> => api.get('/users/me/readiness');
export function useReadiness() {
  return useQuery({ queryKey: READINESS_KEY, queryFn: fetchReadiness, staleTime: 5 * 60_000, retry: false });
}

const bar = (s: number) => (s >= 70 ? 'bg-success' : s >= 40 ? 'bg-primary' : 'bg-reward');

/** Tiny line of the weekly scores (last snapshot of each week). */
function Trend({ history }: { history: Readiness['history'] }) {
  const weekly = Object.values(history.reduce<Record<string, number>>((acc, h) => {
    const d = new Date(`${h.day}T00:00:00Z`);
    const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
    acc[monday] = h.score;
    return acc;
  }, {}));
  if (weekly.length < 2) return null;
  const w = 120, h = 28;
  const pts = weekly.map((s, i) => `${(i / (weekly.length - 1)) * w},${h - (s / 100) * h}`).join(' ');
  const delta = weekly[weekly.length - 1] - weekly[0];
  return (
    <div className="flex items-center gap-2" aria-label={`Readiness over ${weekly.length} weeks: ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} points`}>
      <svg width={w} height={h} className="overflow-visible text-primary" aria-hidden><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
      <span className={cn('text-xs font-semibold', delta >= 0 ? 'text-success' : 'text-destructive')}>{delta >= 0 ? '+' : ''}{delta} in {weekly.length} weeks</span>
    </div>
  );
}

/**
 * Placement readiness from the server: one score, what it is made of, and the three
 * things that would raise it most. `compact` hides the per-part details.
 */
export function ReadinessCard({ compact = false }: { compact?: boolean }) {
  const { data } = useReadiness();
  if (!data) return null;
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      aria-label="Placement readiness"
      className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-indigo-500/5 to-transparent p-5"
    >
      <h3 className="mb-3 flex items-center gap-2 text-sm font-display font-bold text-foreground">
        <Target className="h-4 w-4 text-purple-500" />Placement readiness
      </h3>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-3xl font-display font-bold text-foreground">{data.score}<span className="text-base text-muted-foreground">/100</span></p>
          <p className="text-xs font-semibold text-purple-500">{data.level}</p>
        </div>
        <Trend history={data.history} />
      </div>
      <ul className="space-y-2">
        {data.parts.map((p) => (
          <li key={p.key}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span className="font-medium text-foreground">{p.label} <span className="text-muted-foreground">· {Math.round(p.weight * 100)}%</span></span>
              <span className="font-semibold text-foreground">{p.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={p.label} aria-valuenow={p.score} aria-valuemin={0} aria-valuemax={100}>
              <div className={cn('h-full rounded-full', bar(p.score))} style={{ width: `${p.score}%` }} />
            </div>
            {!compact && <p className="mt-0.5 text-[11px] text-muted-foreground">{p.detail}</p>}
          </li>
        ))}
      </ul>
      {data.nextSteps.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Raise it next</p>
          <ul className="space-y-1">
            {data.nextSteps.map((s) => (
              <li key={s.label}>
                <Link to={s.link} className="flex items-center justify-between rounded-lg bg-secondary/40 px-2.5 py-1.5 text-xs hover:bg-secondary">
                  <span className="text-foreground">{s.label}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-success">up to +{s.gain}<ArrowRight className="h-3 w-3" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.weakTopics.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Topics to work on</p>
          <div className="flex flex-wrap gap-1">
            {data.weakTopics.map((t) => <span key={t} className="rounded-full bg-reward/10 px-2 py-0.5 text-[10px] font-semibold text-reward">{t}</span>)}
          </div>
        </div>
      )}
    </motion.section>
  );
}
