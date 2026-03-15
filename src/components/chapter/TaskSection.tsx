import React, { useState, useEffect } from 'react';
import { api } from '@/services/api.svc';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Task {
  title: string;
  description: string;
}

interface TaskSectionProps {
  chapterId: string;
  task: Task;
  onComplete: () => void;
  isCompleted?: boolean;
}

export const TaskSection: React.FC<TaskSectionProps> = ({
  chapterId,
  task,
  onComplete,
  isCompleted = false
}) => {
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(isCompleted);

  useEffect(() => {
    const savedNotes = localStorage.getItem(`dsa_os_task_notes_${chapterId}`);
    if (savedNotes) {
      setNotes(savedNotes);
    }
    setCompleted(isCompleted);
  }, [chapterId, isCompleted]);

  if (!task) return null;

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    localStorage.setItem(`dsa_os_task_notes_${chapterId}`, val);
  };

  const handleMarkDone = async () => {
    setLoading(true);
    try {
      await api.post(`/chapters/${chapterId}/progress/task`, {
        notes: notes
      });
      setCompleted(true);
      onComplete();
      toast.success('Task marked as complete! ✅');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-2">
      <div className="bg-slate-50 rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-200 bg-white">
          <h3 className="font-bold text-lg text-slate-800 mb-2">{task.title}</h3>
          <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
            {task.description}
          </p>
        </div>

        <div className="p-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Write your solution or notes here...
          </label>
          <textarea
            value={notes}
            onChange={handleNotesChange}
            disabled={completed}
            placeholder="Type your notes here. They will be saved locally automatically."
            className="w-full min-h-[120px] p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 resize-y transition-shadow disabled:bg-slate-50 disabled:text-slate-500 text-sm sm:text-base outline-none"
          />

          <div className="mt-6 flex justify-end">
            {completed ? (
              <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-5 h-5" />
                Task Completed
              </div>
            ) : (
              <button
                onClick={handleMarkDone}
                disabled={loading || !notes.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit & Mark Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
