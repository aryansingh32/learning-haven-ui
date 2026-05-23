import React, { useState, useEffect } from 'react';
import { api } from '@/services/api.svc';
import { CheckCircle2, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ChapterCta } from './ChapterCta';

interface Task {
  title: string;
  description: string;
}

interface TaskSectionProps {
  chapterId: string;
  task: Task;
  onComplete: () => void;
  onProceed?: () => void;
  isCompleted?: boolean;
}

export const TaskSection: React.FC<TaskSectionProps> = ({
  chapterId,
  task,
  onComplete,
  onProceed,
  isCompleted = false,
}) => {
  const storageKey = `lh_task_notes_${chapterId}`;
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setNotes(saved);
    setCompleted(isCompleted);
    setEditing(false);
  }, [chapterId, isCompleted, storageKey]);

  if (!task) return null;

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    localStorage.setItem(storageKey, val);
  };

  const handleSubmit = async () => {
    if (!notes.trim()) return;

    if (completed && editing) {
      const ok = window.confirm(
        'Submitting again will replace your previous task response. Your old answer will be removed. Continue?'
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      await api.post(`/chapters/${chapterId}/progress/task`, { notes });
      setCompleted(true);
      setEditing(false);
      onComplete();
      toast.success(completed ? 'Task updated!' : 'Task marked as complete!');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      toast.error(message || 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const startRedo = () => {
    setEditing(true);
    toast.info('Your previous response will be replaced when you submit again.');
  };

  const showForm = !completed || editing;

  return (
    <div className="pt-2">
      <div className="rounded-xl border border-border/50 bg-secondary/20 overflow-hidden">
        <div className="p-6 border-b border-border/40">
          <h3 className="font-bold text-lg text-foreground mb-2">{task.title}</h3>
          <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>

        <div className="p-6">
          {completed && !editing && (
            <div className="mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Task submitted
              </div>
              <button
                type="button"
                onClick={startRedo}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Redo task
              </button>
            </div>
          )}

          {editing && (
            <p className="mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              Submitting will remove your previous response and save this as your latest submission.
            </p>
          )}

          {showForm && (
            <>
              <label className="block text-sm font-semibold text-foreground mb-3">
                Write your solution or notes here...
              </label>
              <textarea
                value={notes}
                onChange={handleNotesChange}
                placeholder="Type your notes here. They are saved locally as you type."
                className="w-full min-h-[140px] p-4 rounded-xl border border-border bg-background focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 resize-y transition-shadow text-sm outline-none"
              />
            </>
          )}

          {!showForm && completed && (
            <div className="rounded-xl border border-border/40 bg-background/50 p-4 text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
              {notes || 'No notes saved.'}
            </div>
          )}

          {completed && !editing && onProceed && (
            <div className="mt-6 flex justify-end">
              <ChapterCta variant="secondary" onClick={onProceed}>
                Continue to next step
              </ChapterCta>
            </div>
          )}

          {showForm && (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading || !notes.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-orange-600 hover:to-amber-600 transition-colors shadow-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {completed && editing ? 'Replace & submit' : 'Submit & mark done'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
