import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Flame, Gift, Lock, Medal, Trophy, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  claimMission, fetchLeaderboard, setLeaderboardHidden, weekLabel, missionUnit, leaderboardKey, ACHIEVEMENTS_KEY,
  type Achievements, type Mission,
} from './achievements.service';

const card = 'card-glass rounded-2xl p-5 sm:p-6 border border-border/40';

const announced = new Set<string>();
/** Toasts milestones the server just awarded (once per page load) and refreshes the XP shown in the sidebar. */
export function useAnnounceMilestones(data: Achievements | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    const fresh = (data?.new_milestones ?? []).filter((m) => !announced.has(m.id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => announced.add(m.id));
    qc.invalidateQueries({ queryKey: ['user-identity'] });
    toast.success(fresh.length === 1 ? `Milestone reached: ${fresh[0].emoji} ${fresh[0].name}` : `${fresh.length} milestones reached`, {
      description: `${fresh.map((m) => m.name).join(', ')} · +${fresh.reduce((s, m) => s + m.xp, 0)} XP`,
    });
  }, [data, qc]);
}

function Bar({ pct, label, className }: { pct: number; label: string; className?: string }) {
  return (
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full bg-primary', className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Weekly missions ────────────────────────────────────────────────────────

export function WeeklyMissions({ data, compact = false }: { data: Achievements; compact?: boolean }) {
  const qc = useQueryClient();
  const claim = useMutation({
    mutationFn: claimMission,
    onSuccess: (r) => {
      qc.setQueryData(ACHIEVEMENTS_KEY, r.achievements);
      qc.invalidateQueries({ queryKey: ['user-identity'] });
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      if (r.result === 'capped') toast.message('Reward saved', { description: "You've reached today's XP limit — this XP is added tomorrow." });
      else toast.success('Mission reward claimed');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not claim this mission'),
  });
  const done = data.missions.filter((m) => m.state === 'paid' || m.state === 'pending').length;

  return (
    <section aria-labelledby="missions-heading" className={card}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 id="missions-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2">
            <Gift className="w-5 h-5 text-reward" aria-hidden /> Weekly missions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weekLabel(data.week.start, data.week.end)} · {data.week.days_left === 1 ? 'last day' : `${data.week.days_left} days left`} · {done}/{data.missions.length} claimed
          </p>
        </div>
      </div>
      {!data.rewards_enabled && (
        <p className="text-xs text-muted-foreground rounded-lg bg-secondary/50 px-3 py-2 mb-3">Rewards are being switched on. Your progress is counted already.</p>
      )}
      <ul className="space-y-2.5">
        {data.missions.map((m) => (
          <MissionRow key={m.key} m={m} compact={compact} disabled={!data.rewards_enabled || claim.isPending}
            onClaim={() => claim.mutate(m.key)} busy={claim.isPending && claim.variables === m.key} />
        ))}
      </ul>
      {!compact && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Missions reset every Monday (India time). Reward XP today: {data.xp_today.paid} of {data.xp_today.cap}
          {data.xp_today.pending > 0 && ` · ${data.xp_today.pending} XP waiting for tomorrow`}.
        </p>
      )}
    </section>
  );
}

function MissionRow({ m, compact, disabled, busy, onClaim }: { m: Mission; compact: boolean; disabled: boolean; busy: boolean; onClaim: () => void }) {
  const pct = Math.round((m.progress / m.target) * 100);
  return (
    <li className={cn('rounded-xl border px-3.5 py-3', m.state === 'paid' ? 'bg-success/5 border-success/20' : 'bg-background/50 border-border/50')}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground break-words">{m.label}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{m.progress} / {m.target} {missionUnit(m)} · +{m.xp} XP</p>
        </div>
        {m.state === 'claimable' && (
          <Button size="sm" className="shrink-0" onClick={onClaim} disabled={disabled} aria-label={`Claim ${m.xp} XP for ${m.label}`}>
            {busy ? 'Claiming…' : `Claim +${m.xp}`}
          </Button>
        )}
        {m.state === 'paid' && <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-success"><Check className="w-3.5 h-3.5" aria-hidden /> Claimed</span>}
        {m.state === 'pending' && (
          <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-reward" title="Today's XP limit is reached; this XP is added tomorrow">
            <Clock className="w-3.5 h-3.5" aria-hidden /> XP tomorrow
          </span>
        )}
      </div>
      {!compact || m.state === 'locked' ? <Bar pct={pct} label={`${m.label} progress`} className={m.state === 'paid' ? 'bg-success' : undefined} /> : null}
    </li>
  );
}

// ─── Coding streak ──────────────────────────────────────────────────────────

export function CodingStreakCard({ data }: { data: Achievements }) {
  const s = data.coding_streak;
  const hint = s.current === 0
    ? 'Solve a problem today to start a coding streak.'
    : s.today_done ? 'You coded today. Come back tomorrow to keep it going.' : 'Solve a problem today to keep your streak.';
  return (
    <section aria-labelledby="coding-streak-heading" className={card}>
      <h2 id="coding-streak-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-3">
        <Flame className="w-5 h-5 text-reward" aria-hidden /> Coding streak
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-secondary/40 border border-border/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Current</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{s.current} <span className="text-sm font-medium text-muted-foreground">{s.current === 1 ? 'day' : 'days'}</span></p>
        </div>
        <div className="rounded-xl bg-secondary/40 border border-border/40 p-3">
          <p className="text-[11px] font-semibold text-muted-foreground">Longest</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{s.longest} <span className="text-sm font-medium text-muted-foreground">{s.longest === 1 ? 'day' : 'days'}</span></p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">{hint} A day counts when you solve at least one problem (India time).</p>
    </section>
  );
}

// ─── Milestones ─────────────────────────────────────────────────────────────

export function Milestones({ data }: { data: Achievements }) {
  return (
    <section aria-labelledby="milestones-heading" className={card}>
      <h2 id="milestones-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-1">
        <Medal className="w-5 h-5 text-primary" aria-hidden /> Milestones
      </h2>
      <p className="text-xs text-muted-foreground mb-4">Each milestone gives a badge and XP, once.</p>
      <ul className="grid sm:grid-cols-2 gap-2.5">
        {data.milestones.map((m) => (
          <li key={m.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', m.earned ? 'border-reward/30 bg-reward/5' : 'border-border/50 bg-background/50')}>
            <span className={cn('text-2xl leading-none', !m.earned && 'grayscale opacity-40')} aria-hidden>{m.badge.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{m.badge.name}</p>
              <p className="text-[11px] text-muted-foreground">{m.label} · +{m.xp} XP</p>
              {!m.earned && <Bar pct={Math.round((m.progress / m.target) * 100)} label={`${m.badge.name} progress`} />}
            </div>
            <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {m.earned ? (m.reward === 'pending' ? <span className="text-reward">XP tomorrow</span> : <span className="text-success inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" aria-hidden />Earned</span>) : `${m.progress}/${m.target}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── Collections ────────────────────────────────────────────────────────────

export function Collections({ data }: { data: Achievements }) {
  return (
    <section aria-labelledby="collections-heading" className={card}>
      <h2 id="collections-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-reward" aria-hidden /> Badge collections
      </h2>
      <div className="grid md:grid-cols-2 gap-4">
        {data.collections.map((c) => (
          <article key={c.id} className="rounded-xl border border-border/50 bg-background/50 p-4" aria-label={`${c.name}: ${c.earned} of ${c.total} badges`}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-foreground">{c.name}</h3>
              <span className={cn('text-xs font-semibold tabular-nums', c.complete ? 'text-success' : 'text-muted-foreground')}>{c.earned} of {c.total}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-2">{c.description}</p>
            <Bar pct={Math.round((c.earned / c.total) * 100)} label={`${c.name} collection progress`} className={c.complete ? 'bg-success' : undefined} />
            <ul className="flex flex-wrap gap-2 mt-3">
              {c.badges.map((b) => (
                <li key={b.id} title={b.earned ? `${b.name} — earned` : `${b.name} — ${b.hint}`}
                  className={cn('flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium max-w-full',
                    b.earned ? 'border-reward/30 bg-reward/10 text-foreground' : 'border-border/50 text-muted-foreground')}>
                  <span className={cn(!b.earned && 'grayscale opacity-40')} aria-hidden>{b.emoji}</span>
                  <span className="truncate">{b.name}</span>
                  {!b.earned && <Lock className="w-3 h-3 shrink-0" aria-label="not earned yet" />}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export function LeaderboardPanel() {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<'all' | 'week'>('week');
  const { data, isLoading } = useQuery({ queryKey: leaderboardKey(period), queryFn: () => fetchLeaderboard(period), staleTime: 30_000, retry: false });
  const hide = useMutation({
    mutationFn: setLeaderboardHidden,
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['leaderboard'] });
      toast.success(r.hidden ? 'You are hidden from the leaderboard' : 'You are on the leaderboard again');
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save your choice'),
  });
  const hidden = hide.isPending ? Boolean(hide.variables) : Boolean(data?.me.hidden);

  return (
    <section aria-labelledby="leaderboard-heading" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 id="leaderboard-heading" className="text-lg font-display font-bold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" aria-hidden /> Leaderboard
        </h2>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'all' | 'week')}>
          <TabsList aria-label="Leaderboard period">
            <TabsTrigger value="week">This week</TabsTrigger>
            <TabsTrigger value="all">All time</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && !data.available && <p className="text-sm text-muted-foreground">The leaderboard is being switched on. Check back soon.</p>}
      {data?.available && (
        <>
          <div className="rounded-xl bg-primary/5 border border-primary/20 px-4 py-3 mb-3 flex items-center justify-between gap-3">
            <p className="text-sm text-foreground">
              {data.me.hidden
                ? <span className="inline-flex items-center gap-1.5"><EyeOff className="w-4 h-4" aria-hidden /> You're hidden from the leaderboard</span>
                : data.me.rank ? <>Your rank: <strong className="tabular-nums">#{data.me.rank}</strong> of {data.total}</> : <>Earn XP {period === 'week' ? 'this week ' : ''}to get a rank</>}
            </p>
            <span className="text-sm font-semibold text-reward tabular-nums shrink-0">{data.me.xp} XP</span>
          </div>
          {data.entries.length === 0
            ? <p className="text-sm text-muted-foreground py-4 text-center">No one has earned XP {period === 'week' ? 'this week' : ''} yet.</p>
            : (
              <ol className="divide-y divide-border/40" aria-label={period === 'week' ? 'XP earned this week' : 'All-time XP'}>
                {data.entries.map((e) => (
                  <li key={`${e.rank}-${e.name}-${e.xp}`} className={cn('flex items-center gap-3 py-2.5 px-2 rounded-lg', e.is_me && 'bg-reward/10')} aria-current={e.is_me ? 'true' : undefined}>
                    <span className={cn('w-8 text-center text-sm font-bold tabular-nums', e.rank <= 3 ? 'text-reward' : 'text-muted-foreground')}>{e.rank}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-foreground">{e.name}{e.is_me && <span className="text-muted-foreground"> (you)</span>}</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">{e.xp} XP</span>
                  </li>
                ))}
              </ol>
            )}
          <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-border/40">
            <Label htmlFor="leaderboard-visible" className="text-sm font-normal text-foreground leading-snug">
              Show me on the leaderboard
              <span className="block text-[11px] text-muted-foreground">Others see your first name and initial, and your XP. Nothing else.</span>
            </Label>
            <Switch id="leaderboard-visible" checked={!hidden} disabled={hide.isPending} onCheckedChange={(on) => hide.mutate(!on)} />
          </div>
        </>
      )}
    </section>
  );
}
