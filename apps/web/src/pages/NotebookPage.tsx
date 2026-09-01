import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2,
  NotebookText, CheckCircle2, XCircle, ListChecks, Pencil, Save, X, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { fetchCourseNotebook, exportCourseNotebookPdf, saveChapterNotes, type NotebookEntry } from '@/data/notebook';
import { PremiumLockBadge } from '@/components/PremiumLockBadge';
import { parseEntitlementError } from '@/lib/entitlementError';
import { toast } from 'sonner';

type NotebookPage =
  | { kind: 'cover' }
  | { kind: 'toc' }
  | { kind: 'mock_test' }
  | { kind: 'chapter'; entry: NotebookEntry };

export default function NotebookPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const { data: notebook, isLoading } = useQuery({
    queryKey: ['notebook', courseId],
    queryFn: () => fetchCourseNotebook(courseId!),
    enabled: Boolean(courseId),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportCourseNotebookPdf(courseId!),
    onSuccess: (res) => {
      window.open(res.url, '_blank', 'noopener,noreferrer');
      toast.success('Your notebook PDF is ready.');
    },
    onError: (err) => {
      const { denied } = parseEntitlementError(err);
      if (denied) {
        toast.error('PDF export is a Pro feature.', {
          action: { label: 'Upgrade', onClick: () => navigate('/pricing') },
        });
      } else {
        toast.error('Could not generate the PDF. Try again.');
      }
    },
  });

  const saveNotesMutation = useMutation({
    mutationFn: ({ chapterId, content }: { chapterId: string; content: string }) => saveChapterNotes(chapterId, content),
    onSuccess: () => {
      toast.success('Notebook updated');
      setEditingChapterId(null);
      void qc.invalidateQueries({ queryKey: ['notebook', courseId] });
    },
    onError: () => toast.error('Could not save your edits. Try again.'),
  });

  const pages: NotebookPage[] = useMemo(() => {
    if (!notebook) return [];
    return [
      { kind: 'cover' },
      { kind: 'toc' },
      ...(notebook.mock_test ? [{ kind: 'mock_test' as const }] : []),
      ...notebook.entries.map((entry) => ({ kind: 'chapter' as const, entry })),
    ];
  }, [notebook]);

  const goTo = (index: number) => {
    if (index < 0 || index >= pages.length) return;
    setDirection(index > pageIndex ? 1 : -1);
    setPageIndex(index);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="max-w-3xl mx-auto card-layer-2 rounded-2xl p-8 text-center">
        <p className="text-lg font-semibold">Notebook not found</p>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold"
        >
          <ArrowLeft className="h-4 w-4" /> Back to courses
        </button>
      </div>
    );
  }

  const page = pages[pageIndex];

  const variants = {
    enter: (dir: number) => ({ rotateY: dir > 0 ? 90 : -90, opacity: 0 }),
    center: { rotateY: 0, opacity: 1 },
    exit: (dir: number) => ({ rotateY: dir > 0 ? -90 : 90, opacity: 0 }),
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20 md:pb-8">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(courseId ? `/course/${courseId}/chapters` : '/courses')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to course
        </button>

        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || !notebook.has_content}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-md text-white px-4 py-2 text-sm font-bold transition-all"
          title={!notebook.has_content ? 'Add some notes first' : undefined}
        >
          {exportMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download PDF
          <PremiumLockBadge className="ml-1" />
        </button>
      </div>

      <div className="text-center">
        <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground font-bold">My Notebook</p>
        <h1 className="font-display text-2xl font-extrabold text-foreground">{notebook.course.title}</h1>
      </div>

      {/* Book viewport */}
      <div className="relative mx-auto w-full max-w-2xl" style={{ perspective: 1800 }}>
        <div className="relative min-h-[480px] sm:min-h-[560px] rounded-2xl shadow-2xl border border-[#e8e0d0] overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={pageIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
              className="absolute inset-0 bg-[#fdfbf5] text-[#2a2419] p-6 sm:p-10 overflow-y-auto"
            >
              {page?.kind === 'cover' && (
                <div className="h-full flex flex-col items-center justify-center text-center gap-4">
                  <NotebookText className="h-12 w-12 text-orange-500" />
                  <h2 className="font-display text-3xl font-extrabold">{notebook.course.title}</h2>
                  <p className="text-sm text-[#6b5f45]">{notebook.learner_name}</p>
                  <p className="text-xs text-[#8a7d5f]">
                    {notebook.completed_chapters}/{notebook.total_chapters} chapters completed
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-[#8a7d5f] mt-6">
                    Generated by Learning Haven
                  </p>
                </div>
              )}

              {page?.kind === 'toc' && (
                <div className="space-y-4">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <ListChecks className="h-5 w-5 text-orange-500" /> Table of Contents
                  </h3>
                  <div className="space-y-1.5">
                    {notebook.mock_test && (
                      <button
                        type="button"
                        onClick={() => goTo(pages.findIndex((p) => p.kind === 'mock_test'))}
                        className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm font-bold hover:bg-[#f0ead9] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Trophy className="h-3.5 w-3.5 text-orange-500 shrink-0" /> Mock Test Results
                        </span>
                        <span className="text-[10px] font-bold text-orange-600 shrink-0">{notebook.mock_test.score_percent}%</span>
                      </button>
                    )}
                    {notebook.entries.map((entry) => (
                      <button
                        key={entry.chapter_id}
                        type="button"
                        onClick={() => goTo(pages.findIndex((p) => p.kind === 'chapter' && p.entry.chapter_id === entry.chapter_id))}
                        className="w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#f0ead9] transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {entry.status === 'COMPLETED' && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                          Chapter {entry.chapter_number}: {entry.title}
                        </span>
                        {entry.quiz_score !== null && (
                          <span className="text-[10px] font-bold text-orange-600 shrink-0">{entry.quiz_score}%</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {page?.kind === 'mock_test' && notebook.mock_test && (
                <div className="space-y-4">
                  <h3 className="font-display text-xl font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-orange-500" /> Mock Test Results
                  </h3>
                  <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-4 text-center">
                    <p className="text-3xl font-extrabold text-orange-600">{notebook.mock_test.score_percent}%</p>
                    <p className="text-xs text-[#5b5138] mt-1">
                      {notebook.mock_test.correct_count} / {notebook.mock_test.total_questions} correct
                    </p>
                  </div>
                  <div className="space-y-3">
                    {notebook.mock_test.answers.map((qa, qi) => (
                      <div
                        key={qi}
                        className={cn(
                          'rounded-lg border-l-4 bg-white/40 p-3',
                          qa.is_correct ? 'border-emerald-500/70' : 'border-red-400/70'
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {qa.is_correct ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          )}
                          <p className="text-sm font-semibold leading-relaxed">{qi + 1}. {qa.question}</p>
                        </div>
                        {qa.chapter_title && <p className="text-[10px] pl-6 text-[#8a7d5f] uppercase tracking-wide">{qa.chapter_title}</p>}
                        <p className="text-xs mt-1.5 pl-6 text-[#5b5138]">
                          Your answer: <span className={cn('font-semibold', qa.is_correct ? 'text-emerald-700' : 'text-red-600 line-through decoration-red-400')}>{qa.selected_text || '(skipped)'}</span>
                        </p>
                        {!qa.is_correct && qa.correct_option && (
                          <p className="text-xs pl-6 text-emerald-700 font-semibold">Correct answer: {qa.correct_option}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {page?.kind === 'chapter' && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[#8a7d5f] font-bold">
                      Chapter {page.entry.chapter_number}
                    </p>
                    <h3 className="font-display text-2xl font-extrabold">{page.entry.title}</h3>
                    {page.entry.quiz_score !== null && (
                      <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-orange-600 bg-orange-500/10 px-2.5 py-1 rounded-full">
                        Quiz score: {page.entry.quiz_score}%
                      </span>
                    )}
                  </div>

                  {page.entry.doc_summary ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#8a7d5f] mb-2 flex items-center gap-1.5">
                        Chapter Summary
                      </p>
                      <p className="text-sm leading-relaxed text-[#3a3222]">{page.entry.doc_summary}</p>
                      {page.entry.doc_images?.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {page.entry.doc_images.map((src, i) => (
                            <div key={i} className="rounded-lg overflow-hidden border border-[#e8e0d0] bg-white/40 aspect-video flex items-center justify-center">
                              <img
                                src={src}
                                alt={`Chapter ${page.entry.chapter_number} illustration ${i + 1}`}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none'; }}
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-[#8a7d5f]">My Notes</p>
                      {editingChapterId === page.entry.chapter_id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => saveNotesMutation.mutate({ chapterId: page.entry.chapter_id, content: editContent })}
                            disabled={saveNotesMutation.isPending}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                          >
                            {saveNotesMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingChapterId(null)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8a7d5f] hover:text-[#5b5138]"
                          >
                            <X className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingChapterId(page.entry.chapter_id);
                            setEditContent(page.entry.notes);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-600 hover:text-orange-700"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      )}
                    </div>

                    {editingChapterId === page.entry.chapter_id ? (
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[160px] text-sm bg-white/60 text-[#2a2419]"
                        placeholder="Write your notes for this chapter..."
                      />
                    ) : page.entry.notes ? (
                      <div className="prose prose-sm max-w-none text-[#2a2419]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.entry.notes}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs text-[#a89a76] italic">No notes yet — click Edit to add some.</p>
                    )}
                  </div>

                  {page.entry.quiz_answers?.length ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#8a7d5f] mb-2">Quiz Review</p>
                      <div className="space-y-3">
                        {page.entry.quiz_answers.map((qa, qi) => (
                          <div
                            key={qi}
                            className={cn(
                              'rounded-lg border-l-4 bg-white/40 p-3',
                              qa.is_correct ? 'border-emerald-500/70' : 'border-red-400/70'
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {qa.is_correct ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              )}
                              <p className="text-sm font-semibold leading-relaxed">{qi + 1}. {qa.question}</p>
                            </div>
                            <p className="text-xs mt-1.5 pl-6 text-[#5b5138]">
                              Your answer: <span className={cn('font-semibold', qa.is_correct ? 'text-emerald-700' : 'text-red-600 line-through decoration-red-400')}>{qa.selected_text}</span>
                            </p>
                            {!qa.is_correct && qa.correct_option && (
                              <p className="text-xs pl-6 text-emerald-700 font-semibold">Correct answer: {qa.correct_option}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {page.entry.task_response ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-[#8a7d5f] mb-2">Task Response</p>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{page.entry.task_response}</p>
                    </div>
                  ) : null}

                </div>
              )}

              <div className="absolute bottom-3 right-4 text-[10px] text-[#a89a76]">{pageIndex + 1} / {pages.length}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav */}
        <div className="flex items-center justify-between mt-4">
          <button
            type="button"
            onClick={() => goTo(pageIndex - 1)}
            disabled={pageIndex === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all',
              pageIndex === 0
                ? 'opacity-30 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
            )}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="text-xs font-semibold text-muted-foreground">
            {page?.kind === 'chapter'
              ? page.entry.title
              : page?.kind === 'toc'
                ? 'Contents'
                : page?.kind === 'mock_test'
                  ? 'Mock Test Results'
                  : 'Cover'}
          </span>
          <button
            type="button"
            onClick={() => goTo(pageIndex + 1)}
            disabled={pageIndex === pages.length - 1}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-all',
              pageIndex === pages.length - 1
                ? 'opacity-30 cursor-not-allowed bg-secondary text-muted-foreground'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            )}
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
