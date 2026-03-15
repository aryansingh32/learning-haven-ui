import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/services/api.svc';
import { CheckCircle2, Lock, Unlock, Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import JSConfetti from 'js-confetti';

interface UnlockSectionProps {
  chapterId: string;
  nextChapterId?: string;
  quizPassed: boolean;
  taskCompleted: boolean;
  skipTokens: number;
  onSkipped: () => void;
  onUnlocked: () => void;
}

export const UnlockSection: React.FC<UnlockSectionProps> = ({
  chapterId,
  nextChapterId,
  quizPassed,
  taskCompleted,
  skipTokens,
  onSkipped,
  onUnlocked
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  const isReady = quizPassed && taskCompleted;

  const handleUnlock = async () => {
    if (!isReady) return;
    setLoading(true);
    try {
      await api.post(`/chapters/unlock`, { chapter_id: nextChapterId || chapterId });

      const jsConfetti = new JSConfetti();
      jsConfetti.addConfetti({
        emojis: ['🎉', '🚀', '🔥', '✨'],
      });

      toast.success('Chapter Unlocked! 🎉');
      onUnlocked();
      setTimeout(() => navigate('/roadmap-preview'), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to unlock chapter');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (skipTokens <= 0) return;

    if (!window.confirm('Are you sure you want to use a skip token? You cannot undo this.')) {
      return;
    }

    setSkipLoading(true);
    try {
      await api.post(`/chapters/skip-unlock`, { chapter_id: nextChapterId || chapterId });

      const jsConfetti = new JSConfetti();
      jsConfetti.addConfetti({
        emojis: ['⏭️', '🚀', '✨'],
      });

      toast.success('Chapter Skipped using Token! ⏭️');
      onSkipped();
      setTimeout(() => navigate('/roadmap-preview'), 1500);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to skip chapter');
    } finally {
      setSkipLoading(false);
    }
  };

  return (
    <div className="pt-2 text-center">
        {!isReady ? (
          <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8">
            <div className="w-16 h-16 bg-slate-200 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8" />
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-800 mb-6">
              Complete to Unlock Next Chapter
            </h3>

            <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${quizPassed ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                <span className="font-semibold text-sm">Quiz passed (≥66%)</span>
                <span>{quizPassed ? '✅' : '⏳'}</span>
              </div>
              <div className={`flex items-center justify-between p-4 rounded-xl border ${taskCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                <span className="font-semibold text-sm">Task completed</span>
                <span>{taskCompleted ? '✅' : '⏳'}</span>
              </div>
            </div>

            <button
              disabled
              className="w-full h-14 bg-slate-200 text-slate-400 font-bold rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              Unlock Next Chapter <Lock className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-3xl p-8 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm shadow-emerald-200/50">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-900 mb-2">
              You did it! 🚀
            </h3>
            <p className="text-emerald-700 font-medium mb-8">
              All requirements met for this chapter.
            </p>

            <button
              onClick={handleUnlock}
              disabled={loading}
              className="w-full h-16 bg-emerald-600 text-white text-lg font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:-translate-y-1 transition-all"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                <>
                  <Unlock className="w-6 h-6" /> Unlock Next Chapter &rarr;
                </>
              )}
            </button>
          </div>
        )}

        {/* Skip Token Section */}
        {skipTokens > 0 && !isReady && (
          <div className="mt-6">
            <button
              onClick={handleSkip}
              disabled={skipLoading}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors px-4 py-2 rounded-lg hover:bg-blue-50"
            >
              {skipLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-amber-500" />}
              Or use a Skip Token — you have {skipTokens} remaining
            </button>
          </div>
        )}
    </div>
  );
};
