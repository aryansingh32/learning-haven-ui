import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { ApiError, post } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { downloadText, QUESTION_TEMPLATE, readSpreadsheet, SPREADSHEET_ACCEPT } from '@/lib/sheets';

interface Preview {
  summary: { valid: number; invalid: number; byType: { mcq: number; msq: number; nat: number }; sections: string[] };
  errors: Array<{ line: number; message: string }>;
  sample: Array<{ line: number; type: string; body: string; options: string[]; correct: number[]; natAnswer: number | null; marks: number; section: string | null }>;
}

const LETTERS = 'ABCDEFGHIJ';

/** Bring a college's question bank in from Excel or CSV: preview first, then all-or-nothing import. */
export function ImportQuestions({ orgId, testId, onImported }: { orgId: string; testId: string; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const base = `/orgs/${orgId}/tests/${testId}/questions/import`;

  const check = useMutation({
    mutationFn: (text: string) => post<Preview>(`${base}/preview`, { csv: text }),
    onSuccess: setPreview,
    onError: (e) => toast.error(e.message),
  });
  const run = useMutation({
    mutationFn: () => post<{ imported: number; sectionsCreated: number }>(base, { csv }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.imported} questions${r.sectionsCreated ? ` and created ${r.sectionsCreated} sections` : ''}`);
      reset(); setOpen(false); onImported();
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Import failed'),
  });
  const reset = () => { setCsv(null); setPreview(null); setFileName(''); if (fileRef.current) fileRef.current.value = ''; };

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      const text = await readSpreadsheet(file);
      setCsv(text); setFileName(file.name); setPreview(null);
      check.mutate(text);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Import from Excel</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Import questions</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              One question per row: <strong className="text-foreground">Type</strong> (mcq, msq, nat), <strong className="text-foreground">Question</strong>,{' '}
              <strong className="text-foreground">Option A…J</strong>, <strong className="text-foreground">Answer</strong> (a letter like B, several like A,C, or the number for nat),
              and optionally Marks, Negative marks, Section, Topic, Difficulty, Explanation. Sections that don't exist yet are created. Coding questions are added in the editor.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => downloadText('question-template.csv', QUESTION_TEMPLATE)}>
                <Download className="mr-1.5 h-4 w-4" /> Download template
              </Button>
              <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={check.isPending}>
                <Upload className="mr-1.5 h-4 w-4" /> {fileName ? 'Choose another file' : 'Choose .xlsx or .csv'}
              </Button>
              <input ref={fileRef} type="file" accept={SPREADSHEET_ACCEPT} className="hidden" aria-label="Question sheet" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
            {fileName && <p className="text-xs text-muted-foreground">{fileName}{check.isPending ? ' — checking…' : ''}</p>}

            {preview && (
              <>
                <div className="flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1 font-medium text-success"><CheckCircle2 className="h-4 w-4" /> {preview.summary.valid} ready</span>
                  <span className="text-muted-foreground">{preview.summary.byType.mcq} single · {preview.summary.byType.msq} multiple · {preview.summary.byType.nat} numeric</span>
                  {preview.summary.sections.length > 0 && <span className="text-muted-foreground">Sections: {preview.summary.sections.join(', ')}</span>}
                  {preview.summary.invalid > 0 && <span className="inline-flex items-center gap-1 font-medium text-destructive"><AlertTriangle className="h-4 w-4" /> {preview.summary.invalid} to fix</span>}
                </div>
                {preview.errors.length > 0 && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <p className="mb-1 font-medium">Fix these lines in your sheet, then choose the file again. Nothing is imported until every line is right.</p>
                    <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs">
                      {preview.errors.map((e) => <li key={e.line}><span className="font-mono">Line {e.line}:</span> {e.message}</li>)}
                    </ul>
                  </div>
                )}
                {preview.sample.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">First questions</p>
                    <ol className="space-y-2">
                      {preview.sample.map((q) => (
                        <li key={q.line} className="rounded-md border p-2">
                          <p className="font-medium">{q.body}</p>
                          <p className="text-xs text-muted-foreground">
                            {q.type.toUpperCase()} · {q.marks} {q.marks === 1 ? 'mark' : 'marks'}{q.section ? ` · ${q.section}` : ''} · answer:{' '}
                            <span className="text-success">{q.type === 'nat' ? q.natAnswer : q.correct.map((i) => `${LETTERS[i]} (${q.options[i]})`).join(', ')}</span>
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => run.mutate()} disabled={!preview || preview.errors.length > 0 || preview.summary.valid === 0 || run.isPending}>
              Import {preview?.summary.valid ?? ''} questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
