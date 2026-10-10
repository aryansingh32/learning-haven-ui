import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { collapseUnchanged, diffLines, diffStats, toSideBySide, type DiffOp, type SideBySideRow } from '../lineDiff';

export interface DiffSide { label: string; code: string }

type Mode = 'split' | 'inline';
const MODE_KEY = 'forge-diff-mode';

/** Side-by-side or inline diff of two versions of a solution. Narrow screens start inline. */
export const CodeDiffView: React.FC<{ before: DiffSide; after: DiffSide; className?: string }> = ({ before, after, className }) => {
  const ops = useMemo(() => diffLines(before.code, after.code), [before.code, after.code]);
  const stats = useMemo(() => diffStats(ops), [ops]);
  const [mode, setMode] = useState<Mode>(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === 'split' || saved === 'inline') return saved;
    } catch { /* storage unavailable */ }
    return typeof window !== 'undefined' && window.innerWidth < 768 ? 'inline' : 'split';
  });
  useEffect(() => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage unavailable */ } }, [mode]);
  const [showAll, setShowAll] = useState(false);
  const same = stats.added === 0 && stats.removed === 0;

  return (
    <section aria-label="Code differences" className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <p className="text-zinc-300 min-w-0">
          <span className="font-semibold text-rose-300 break-words">{before.label}</span>
          <span className="text-zinc-500"> → </span>
          <span className="font-semibold text-emerald-300 break-words">{after.label}</span>
        </p>
        <span className="text-zinc-500 tabular-nums" aria-live="polite">
          {same ? 'No differences' : <><span className="text-emerald-400">+{stats.added}</span> <span className="text-rose-400">−{stats.removed}</span> lines</>}
        </span>
        <div role="radiogroup" aria-label="Diff layout" className="ml-auto inline-flex rounded-md border border-white/10 overflow-hidden">
          {(['split', 'inline'] as Mode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn('px-2.5 py-1 text-[11px] font-semibold', mode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200')}>
              {m === 'split' ? 'Side by side' : 'Inline'}
            </button>
          ))}
        </div>
      </div>
      {!same && (
        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="accent-emerald-500" />
          Show unchanged lines
        </label>
      )}
      <div className="rounded-lg border border-white/10 bg-black/40 font-mono text-[12px] leading-5 overflow-hidden">
        {mode === 'inline' ? <Inline ops={ops} showAll={showAll || same} /> : <Split rows={toSideBySide(ops)} showAll={showAll || same} labels={[before.label, after.label]} />}
      </div>
    </section>
  );
};

const Skipped = ({ n }: { n: number }) => (
  <div className="px-3 py-0.5 text-[11px] text-zinc-500 bg-zinc-900/60 border-y border-white/5">⋯ {n} unchanged line{n === 1 ? '' : 's'}</div>
);

function Inline({ ops, showAll }: { ops: DiffOp[]; showAll: boolean }) {
  const items = showAll ? ops : collapseUnchanged(ops, (o) => o.type !== 'same');
  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {items.map((it, idx) => {
          if ('skipped' in it) return <Skipped key={`s${idx}`} n={it.skipped} />;
          const op = it as DiffOp;
          return (
            <div key={idx} className={cn('flex', op.type === 'add' && 'bg-emerald-500/10', op.type === 'del' && 'bg-rose-500/10')}>
              <span className="w-9 shrink-0 text-right pr-1 text-zinc-600 select-none">{op.type !== 'add' ? op.a : ''}</span>
              <span className="w-9 shrink-0 text-right pr-1 text-zinc-600 select-none">{op.type !== 'del' ? op.b : ''}</span>
              <span className={cn('w-4 shrink-0 text-center select-none', op.type === 'add' ? 'text-emerald-400' : op.type === 'del' ? 'text-rose-400' : 'text-zinc-700')} aria-hidden>
                {op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}
              </span>
              <span className="sr-only">{op.type === 'add' ? 'added: ' : op.type === 'del' ? 'removed: ' : ''}</span>
              <span className={cn('pr-3 whitespace-pre', op.type === 'add' ? 'text-emerald-200' : op.type === 'del' ? 'text-rose-200' : 'text-zinc-300')}>{op.text || ' '}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Split({ rows, showAll, labels }: { rows: SideBySideRow[]; showAll: boolean; labels: [string, string] }) {
  const items = showAll ? rows : collapseUnchanged(rows, (r) => Boolean(r.left?.changed || r.right?.changed));
  const cell = (side: SideBySideRow['left'], kind: 'del' | 'add') => (
    <div className={cn('flex min-w-0', side?.changed && (kind === 'del' ? 'bg-rose-500/10' : 'bg-emerald-500/10'))}>
      <span className="w-9 shrink-0 text-right pr-2 text-zinc-600 select-none">{side?.no ?? ''}</span>
      {side?.changed && <span className="sr-only">{kind === 'del' ? 'removed: ' : 'added: '}</span>}
      <span title={side?.text} className={cn('whitespace-pre overflow-hidden text-ellipsis pr-2', side?.changed ? (kind === 'del' ? 'text-rose-200' : 'text-emerald-200') : 'text-zinc-300')}>
        {side ? side.text || ' ' : ''}
      </span>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-2 min-w-[560px]">
        <div className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-rose-300/80 border-b border-r border-white/10 truncate">{labels[0]}</div>
        <div className="px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-emerald-300/80 border-b border-white/10 truncate">{labels[1]}</div>
        {items.map((it, idx) => ('skipped' in it
          ? <div key={`s${idx}`} className="col-span-2"><Skipped n={it.skipped} /></div>
          : (
            <React.Fragment key={idx}>
              <div className="border-r border-white/10 min-w-0">{cell((it as SideBySideRow).left, 'del')}</div>
              <div className="min-w-0">{cell((it as SideBySideRow).right, 'add')}</div>
            </React.Fragment>
          )))}
      </div>
    </div>
  );
}
