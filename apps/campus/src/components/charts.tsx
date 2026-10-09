import { useState } from 'react';
import { cn } from '@/lib/utils';

// Small, dependency-free charts for the portal. One series each, in the
// college's primary colour; text stays in text colours. Every chart has a
// hover/focus tooltip and a table view, so no value is reachable only by
// pointing at it.

export interface ColumnDatum { label: string; value: number | null; detail?: string }

/** Vertical columns from one baseline (e.g. a score distribution or a monthly series). */
export function ColumnChart({ data, max, unit = '', height = 160, title, valueLabel = 'Value' }: {
  data: ColumnDatum[]; max?: number; unit?: string; height?: number; title: string; valueLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  // An even top keeps the middle gridline on a whole number.
  const peak = Math.max(1, ...data.map((d) => d.value ?? 0));
  const top = max ?? (peak <= 2 ? 2 : Math.ceil(peak / 2) * 2);
  const ticks = [0, top / 2, top];
  const fmt = (v: number | null) => (v === null ? '—' : `${v}${unit}`);

  return (
    <figure className="space-y-2">
      <figcaption className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{title}</span>
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? 'Show chart' : 'Show table'}
        </button>
      </figcaption>
      {table ? (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-1 font-medium">{''}</th><th className="py-1 text-right font-medium">{valueLabel}</th></tr></thead>
          <tbody className="divide-y">
            {data.map((d) => <tr key={d.label}><td className="py-1">{d.label}</td><td className="py-1 text-right tabular">{fmt(d.value)}{d.detail ? <span className="ml-2 text-xs text-muted-foreground">{d.detail}</span> : null}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div className="flex gap-2">
          {/* y-axis ticks */}
          <div className="relative mt-8 w-8 shrink-0 text-right text-[10px] tabular text-muted-foreground" style={{ height }} aria-hidden>
            {ticks.map((t) => <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - (t / top) * 100}%` }}>{t}{unit}</span>)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative mt-8 border-b border-border" style={{ height }} role="list" aria-label={title}>
              {[0.5, 1].map((f) => <div key={f} className="absolute inset-x-0 border-t border-border/70" style={{ top: `${100 - f * 100}%` }} aria-hidden />)}
              <div className="absolute inset-0 flex items-end gap-[2px]">
                {data.map((d, i) => {
                  const h = d.value === null ? 0 : Math.max(d.value > 0 ? 2 : 0, (d.value / top) * 100);
                  return (
                    <div key={d.label} role="listitem" tabIndex={0} aria-label={`${d.label}: ${fmt(d.value)}${d.detail ? `, ${d.detail}` : ''}`}
                      className="relative flex h-full flex-1 items-end justify-center outline-none"
                      onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                      <div className={cn('w-full max-w-6 rounded-t bg-primary transition-opacity', hover !== null && hover !== i && 'opacity-60')} style={{ height: `${h}%` }} />
                      {hover === i && (
                        <div className="pointer-events-none absolute z-10 whitespace-nowrap rounded-md border bg-card px-2 py-1 text-xs shadow-md"
                          style={{ bottom: `calc(${h}% + 6px)`, ...(i > data.length / 2 ? { right: 0 } : { left: 0 }) }}>
                          <p className="font-semibold tabular">{fmt(d.value)}</p>
                          <p className="text-muted-foreground">{d.label}{d.detail ? ` · ${d.detail}` : ''}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1 flex gap-[2px] text-[10px] text-muted-foreground" aria-hidden>
              {data.map((d, i) => <span key={d.label} className="flex-1 truncate text-center">{data.length > 8 && i % 2 ? '' : d.label}</span>)}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

/** Horizontal bars with the value at the tip (e.g. marks by topic). */
export function BarList({ data, max = 100, unit = '%', title, empty }: {
  data: Array<{ label: string; value: number | null; detail?: string }>; max?: number; unit?: string; title: string; empty?: string;
}) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground">{empty ?? 'No data yet.'}</p>;
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <ul className="space-y-1.5" aria-label={title}>
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_3.5rem] items-center gap-2 text-sm" title={d.detail}>
            <span className="truncate">{d.label}</span>
            <span className="h-3 rounded-r bg-secondary" aria-hidden>
              <span className="block h-3 max-h-6 rounded-r bg-primary" style={{ width: `${d.value === null ? 0 : Math.min(100, (d.value / max) * 100)}%` }} />
            </span>
            <span className="text-right tabular">{d.value === null ? '—' : `${d.value}${unit}`}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
