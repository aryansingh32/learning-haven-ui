import React, { useEffect, useState } from "react";
import { useApiMutation } from "@/hooks/useApi";
import { api } from "@/services/api.svc";

type TaskItem = {
  title?: string;
  description?: string;
};

interface TaskSectionProps {
  chapterId: string;
  task?: TaskItem | null;
  initialCompleted?: boolean;
  onCompletedChange?: (completed: boolean) => void;
}

export const TaskSection: React.FC<TaskSectionProps> = ({
  chapterId,
  task,
  initialCompleted,
  onCompletedChange,
}) => {
  const [notes, setNotes] = useState("");
  const [completed, setCompleted] = useState(!!initialCompleted);

  const mutation = useApiMutation(() =>
    api.post(`/chapters/${chapterId}/progress/task`, {})
  );

  useEffect(() => {
    const key = `chapter_task_notes_${chapterId}`;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setNotes(stored);
    } catch {
      // ignore
    }
  }, [chapterId]);

  useEffect(() => {
    const key = `chapter_task_notes_${chapterId}`;
    try {
      window.localStorage.setItem(key, notes);
    } catch {
      // ignore
    }
  }, [notes, chapterId]);

  useEffect(() => {
    setCompleted(!!initialCompleted);
  }, [initialCompleted]);

  if (!task?.title && !task?.description) return null;

  const handleMarkDone = async () => {
    if (completed) return;
    try {
      await mutation.mutateAsync();
      setCompleted(true);
      onCompletedChange?.(true);
    } catch {
      // silent for now; could add toast
    }
  };

  return (
    <section className="mb-6">
      <p className="text-sm font-semibold text-gray-800 mb-2">
        ✅ Your Task
      </p>
      <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        {task.title && (
          <p className="text-sm font-semibold text-gray-900">
            {task.title}
          </p>
        )}
        {task.description && (
          <p className="text-xs text-gray-600">
            {task.description}
          </p>
        )}
        <div>
          <textarea
            className="w-full min-h-[96px] text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Write your solution or notes here..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={completed}
          className={[
            "w-full h-10 rounded-lg text-sm font-semibold",
            completed
              ? "bg-green-100 text-green-700 cursor-default"
              : "bg-blue-600 text-white hover:bg-blue-700",
          ].join(" ")}
        >
          {completed ? "✓ Task Marked as Done" : "Mark Task as Done"}
        </button>
      </div>
    </section>
  );
};

