import React, { useState } from 'react';
import { learningService } from '../api/learning.service';
import { CheckCircle2, Lock, Unlock, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UnlockSectionProps {
  chapterId: string;
  quizPassed: boolean;
  taskCompleted: boolean;
  skipTokens: number;
  onSkipped: () => void;
  onUnlocked: () => void;
  isUnlocking?: boolean;
}

export const UnlockSection: React.FC<UnlockSectionProps> = ({
  chapterId,
  quizPassed,
  taskCompleted,
  skipTokens,
  onSkipped,
  onUnlocked,
  isUnlocking = false,
}) => {
  const [skipLoading, setSkipLoading] = useState(false);

  const isReady = quizPassed && taskCompleted;

  const handleUnlock = () => {
    if (!isReady || isUnlocking) return;
    onUnlocked();
  };

  const handleSkip = async () => {
    if (skipTokens <= 0) return;

    if (!window.confirm('Are you sure you want to use a skip token? You cannot undo this.')) {
      return;
    }

    setSkipLoading(true);
    try {
      await learningService.skipUnlock(chapterId);
      toast.success('Chapter skipped using token');
      onSkipped();
    } catch (err: unknown) {
      // The API interceptor rejects with a plain Error carrying the server's
      // message, so read `.message` rather than an axios-shaped `.response`.
      const message = err instanceof Error ? err.message : undefined;
      toast.error(message || 'Failed to skip chapter');
    } finally {
      setSkipLoading(false);
    }
  };

  return (
    <div className="pt-2 text-center">
      {!isReady ? (
        <div className="bg-secondary/40 border-2 border-border rounded-3xl p-8">
          <div className="w-16 h-16 bg-secondary text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8" />
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-6">
            Complete to Unlock Next Chapter
          </h3>

          <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${quizPassed ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-card border-border text-muted-foreground'}`}
            >
              <span className="font-semibold text-sm">Quiz passed (≥66%)</span>
              <span>{quizPassed ? '✅' : '⏳'}</span>
            </div>
            <div
              className={`flex items-center justify-between p-4 rounded-xl border ${taskCompleted ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-card border-border text-muted-foreground'}`}
            >
              <span className="font-semibold text-sm">Task completed</span>
              <span>{taskCompleted ? '✅' : '⏳'}</span>
            </div>
          </div>

          <button
            type="button"
            disabled
            className="w-full h-14 bg-secondary text-muted-foreground font-bold rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed"
          >
            Unlock Next Chapter <Lock className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-3xl p-8 animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mb-2">You did it! 🚀</h3>
          <p className="text-emerald-700 font-medium mb-8">All requirements met for this chapter.</p>

          <button
            type="button"
            onClick={handleUnlock}
            disabled={isUnlocking}
            className="w-full h-16 bg-emerald-600 text-white text-lg font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-1 transition-all disabled:opacity-60"
          >
            {isUnlocking ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                <Unlock className="w-6 h-6" /> Unlock &amp; celebrate
              </>
            )}
          </button>
        </div>
      )}

      {skipTokens > 0 && !isReady && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={skipLoading}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition-colors px-4 py-2 rounded-lg hover:bg-primary/10"
          >
            {skipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
            Or use a Skip Token — you have {skipTokens} remaining
          </button>
        </div>
      )}
    </div>
  );
};
