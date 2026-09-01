import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotebookText, Save, Loader2, BookOpen } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fetchChapterNotes, saveChapterNotes } from '@/data/notebook';
import { toast } from 'sonner';

type ChapterNotesPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapterId: string;
  chapterTitle: string;
  courseId?: string;
};

export function ChapterNotesPanel({ open, onOpenChange, chapterId, chapterTitle, courseId }: ChapterNotesPanelProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [content, setContent] = useState('');
  const hasLoaded = useRef(false);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['chapter-notes', chapterId],
    queryFn: () => fetchChapterNotes(chapterId),
    enabled: open,
  });

  useEffect(() => {
    if (notes && !hasLoaded.current) {
      setContent(notes.content || '');
      hasLoaded.current = true;
    }
  }, [notes]);

  useEffect(() => {
    if (!open) hasLoaded.current = false;
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: () => saveChapterNotes(chapterId, content),
    onSuccess: () => {
      toast.success('Notes saved to your notebook');
      void qc.invalidateQueries({ queryKey: ['chapter-notes', chapterId] });
      void qc.invalidateQueries({ queryKey: ['notebook', courseId] });
    },
    onError: () => toast.error('Could not save notes. Try again.'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <NotebookText className="h-5 w-5 text-orange-500" />
            Notes: {chapterTitle}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Write down key takeaways. Markdown supported — these notes are saved into your course notebook.
              </p>
              <Textarea
                placeholder="e.g. The key insight from this chapter is..."
                className="min-h-[300px] text-sm"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 sm:justify-between mt-4">
          {courseId && (
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/course/${courseId}/notebook`)}
              className="gap-2"
            >
              <BookOpen className="h-4 w-4" /> Open Notebook
            </Button>
          )}
          <Button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
            className="gap-2 gradient-golden text-primary-foreground"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Notes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
