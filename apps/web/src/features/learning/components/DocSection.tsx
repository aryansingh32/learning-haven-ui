import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Highlighter, BookPlus, Loader2, Trash2, X } from 'lucide-react';
import { MarkdownContent } from '@/features/build-haven/components/MarkdownContent';
import { ChapterCta } from './ChapterCta';
import { appendChapterNoteHighlight } from '@/data/notebook';
import {
  createHighlight, deleteHighlight, fetchChapterHighlights, HIGHLIGHT_COLORS,
  type ChapterHighlight, type HighlightColor, apiErrorMessage,
} from '@/data/learning';
import { anchorFromSelection, containerText, locateHighlight, rangeFromOffsets, type HighlightAnchor } from '@/features/learning/highlightAnchors';
import { parseEntitlementError } from '@/lib/entitlementError';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type DocSectionProps = {
  markdown: string;
  chapterId?: string;
  chapterTitle?: string;
  stepId?: string;
  courseId?: string;
  onMarkDone?: () => void;
};

export const SWATCH: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  blue: 'bg-sky-300',
  pink: 'bg-pink-300',
};

type CssHighlights = { set: (name: string, h: unknown) => void; delete: (name: string) => void };
const cssHighlights = (): { registry: CssHighlights; Highlight: new (...r: Range[]) => unknown } | null => {
  const w = window as unknown as { CSS?: { highlights?: CssHighlights }; Highlight?: new (...r: Range[]) => unknown };
  return w.CSS?.highlights && w.Highlight ? { registry: w.CSS.highlights, Highlight: w.Highlight } : null;
};

export function DocSection({ markdown, chapterId, chapterTitle, stepId, courseId, onMarkDone }: DocSectionProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selection, setSelection] = useState<HighlightAnchor | null>(null);
  const [color, setColor] = useState<HighlightColor>('yellow');
  const containerRef = useRef<HTMLDivElement>(null);
  const supportsPaint = typeof window !== 'undefined' && Boolean(cssHighlights());

  const highlightsQuery = useQuery({
    queryKey: ['highlights', chapterId],
    queryFn: () => fetchChapterHighlights(chapterId!),
    enabled: Boolean(chapterId),
  });
  // Highlights made in this step (or saved without a step).
  const highlights = useMemo(
    () => (highlightsQuery.data?.highlights ?? []).filter((h) => !stepId || !h.step_id || h.step_id === stepId),
    [highlightsQuery.data, stepId]
  );
  const highlightsAvailable = highlightsQuery.data?.available !== false;

  const refreshAfterChange = () => {
    void qc.invalidateQueries({ queryKey: ['highlights', chapterId] });
    void qc.invalidateQueries({ queryKey: ['notebook', courseId] });
  };

  const createMutation = useMutation({
    mutationFn: (anchor: HighlightAnchor) => createHighlight(chapterId!, { ...anchor, color, step_id: stepId ?? null }),
    onSuccess: () => {
      toast.success('Highlighted');
      setSelection(null);
      window.getSelection()?.removeAllRanges();
      refreshAfterChange();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not save the highlight. Try again.')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHighlight(id),
    onSuccess: () => {
      toast.success('Highlight removed');
      refreshAfterChange();
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not remove the highlight.')),
  });

  const appendMutation = useMutation({
    mutationFn: (text: string) => appendChapterNoteHighlight(chapterId!, text, chapterTitle),
    onSuccess: () => toast.success('Added to your notebook'),
    onError: (err) => {
      const { denied } = parseEntitlementError(err);
      if (denied) {
        toast.error('Adding highlights to your notebook is a Pro feature.', {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      } else {
        toast.error('Could not add to notebook. Try again.');
      }
    },
  });

  // Remember the last selection made inside the lesson (taps on the buttons below clear the
  // live selection on phones, so we keep it until it is saved or dismissed).
  const captureSelection = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const anchor = anchorFromSelection(el, window.getSelection());
    if (anchor) setSelection(anchor);
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, [captureSelection]);

  // Paint saved highlights with the CSS Custom Highlight API (no DOM changes, so React's
  // markdown tree is left alone). Browsers without it still get the list below.
  useLayoutEffect(() => {
    const api = cssHighlights();
    const el = containerRef.current;
    if (!api || !el) return;
    const full = containerText(el);
    const byColor = new Map<HighlightColor, Range[]>();
    for (const h of highlights) {
      const at = locateHighlight(full, h);
      const range = at && rangeFromOffsets(el, at.start, at.end);
      if (range) byColor.set(h.color, [...(byColor.get(h.color) ?? []), range]);
    }
    for (const c of HIGHLIGHT_COLORS) {
      const ranges = byColor.get(c);
      if (ranges?.length) api.registry.set(`forge-hl-${c}`, new api.Highlight(...ranges));
      else api.registry.delete(`forge-hl-${c}`);
    }
    return () => HIGHLIGHT_COLORS.forEach((c) => api.registry.delete(`forge-hl-${c}`));
  }, [highlights, markdown]);

  if (!markdown?.trim()) return null;

  const preview = (t: string) => (t.length > 60 ? `${t.slice(0, 57)}…` : t);

  return (
    <motion.div className="mt-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div
        ref={containerRef}
        onMouseUp={captureSelection}
        onTouchEnd={captureSelection}
        data-testid="doc-content"
        className="rounded-2xl bg-secondary/40 border border-border/50 p-4 space-y-2 break-words"
      >
        <MarkdownContent content={markdown} />
      </motion.div>

      {chapterId && (
        <div className="space-y-2">
          {selection && (
            <div
              role="group"
              aria-label="Selected text"
              className="flex flex-wrap items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/5 p-2"
            >
              <span className="text-xs text-muted-foreground min-w-0 max-w-full truncate">“{preview(selection.text)}”</span>
              {highlightsAvailable && (
                <>
                  <div className="flex items-center gap-1" role="radiogroup" aria-label="Highlight colour">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={color === c}
                        aria-label={`${c} highlight`}
                        onClick={() => setColor(c)}
                        className={cn('h-6 w-6 rounded-full border-2', SWATCH[c], color === c ? 'border-foreground' : 'border-transparent')}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => createMutation.mutate(selection)}
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 text-white px-3 py-1.5 text-xs font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Highlighter className="h-3.5 w-3.5" />}
                    Highlight
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => appendMutation.mutate(selection.text)}
                disabled={appendMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 text-orange-600 px-3 py-1.5 text-xs font-bold hover:bg-orange-500/20 transition-colors disabled:opacity-50"
              >
                {appendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookPlus className="h-3.5 w-3.5" />}
                Add to notes
              </button>
              <button
                type="button"
                onClick={() => setSelection(null)}
                aria-label="Dismiss selection"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!selection && highlightsAvailable && (
              <p className="text-[11px] text-muted-foreground">Select text in the lesson to highlight it.</p>
            )}
            <button
              type="button"
              onClick={() => appendMutation.mutate(markdown)}
              disabled={appendMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/60 text-muted-foreground px-3 py-1.5 text-xs font-bold hover:bg-secondary transition-colors disabled:opacity-50"
            >
              <BookPlus className="h-3.5 w-3.5" />
              Save entire doc to Notebook
            </button>
          </div>

          {highlights.length > 0 && (
            <section aria-label="Your highlights" className="rounded-xl border border-border/50 bg-background/60 p-3">
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Your highlights ({highlights.length})
              </h4>
              {!supportsPaint && (
                <p className="text-[11px] text-muted-foreground mb-2">Your browser can’t colour text in the lesson; your highlights are listed here.</p>
              )}
              <ul className="space-y-1.5" data-testid="highlight-list">
                {highlights.map((h: ChapterHighlight) => (
                  <li key={h.id} className="flex items-start gap-2 text-sm">
                    <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', SWATCH[h.color])} aria-hidden="true" />
                    <span className="flex-1 min-w-0 break-words text-foreground/90">{h.text}</span>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(h.id)}
                      disabled={deleteMutation.isPending}
                      aria-label={`Remove highlight: ${preview(h.text)}`}
                      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {onMarkDone && (
        <ChapterCta variant="secondary" onClick={onMarkDone}>
          Got it, moving on
        </ChapterCta>
      )}
    </motion.div>
  );
}
