import React, { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';

export interface QuizQuestion {
  q?: string;
  question?: string; // fallback for older data structures
  options: string[];
  answer?: number;
  correctAnswer?: number; // fallback
  explanation: string;
}

interface QuizSectionProps {
  questions: QuizQuestion[];
  chapterId: string;
  onComplete: (score: number, passed: boolean) => void;
}

export const QuizSection: React.FC<QuizSectionProps> = ({
  questions = [],
  chapterId,
  onComplete
}) => {
  const [state, setState] = useState<'idle' | 'answering' | 'reviewing' | 'complete'>('idle');
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  if (!questions || questions.length === 0) return null;

  const handleStart = () => {
    setState('answering');
    setCurrentQ(0);
    setScore(0);
    setSelectedOption(null);
  };

  const currentQuestion = questions[currentQ] || {};
  const qText = currentQuestion.q || currentQuestion.question || '';
  const ansIdx = currentQuestion.answer ?? currentQuestion.correctAnswer ?? 0;

  const handleSubmit = () => {
    if (selectedOption === null) return;
    const isCorrect = selectedOption === ansIdx;
    if (isCorrect) setScore(s => s + 1);
    setState('reviewing');
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(q => q + 1);
      setSelectedOption(null);
      setState('answering');
    } else {
      setState('complete');
      const passed = score >= 2;
      onComplete(score, passed);
    }
  };

  const handleRetake = () => {
    setState('idle');
    setCurrentQ(0);
    setScore(0);
    setSelectedOption(null);
  };

  return (
    <div className="mb-10">
      <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-4">
        <span>🧠</span> Quick Check ({questions.length} Questions)
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {state === 'idle' && (
          <div className="text-center py-8">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Ready to test your knowledge?</h3>
            <p className="text-slate-500 mb-6 font-medium">Take a short quiz to unlock the next chapter.</p>
            <button
              onClick={handleStart}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm"
            >
              Start Quiz
            </button>
          </div>
        )}

        {(state === 'answering' || state === 'reviewing') && (
          <div className="animate-in fade-in duration-300">
            <div className="flex justify-between items-center text-sm text-slate-500 mb-4 font-bold tracking-wide uppercase">
              <span>Question {currentQ + 1} of {questions.length}</span>
            </div>

            <h3 className="text-lg font-semibold mb-6 text-slate-800 leading-relaxed">
              {qText}
            </h3>

            <div className="space-y-3 mb-6">
              {currentQuestion.options?.map((opt, idx) => {
                let btnCls = 'border-slate-200 hover:border-blue-400 bg-white';
                const isSelected = selectedOption === idx;
                const isCorrectOption = idx === ansIdx;

                if (state === 'answering') {
                  if (isSelected) btnCls = 'border-blue-600 bg-blue-50 ring-1 ring-blue-600';
                } else if (state === 'reviewing') {
                  if (isCorrectOption) {
                    btnCls = 'border-green-500 bg-green-50 ring-1 ring-green-500';
                  } else if (isSelected && !isCorrectOption) {
                    btnCls = 'border-red-500 bg-red-50 ring-1 ring-red-500';
                  } else {
                    btnCls = 'border-slate-200 bg-slate-50 opacity-50';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={state === 'reviewing'}
                    onClick={() => setSelectedOption(idx)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-4 ${btnCls}`}
                  >
                    <span className="font-semibold text-slate-700">{opt}</span>
                    {state === 'reviewing' && isCorrectOption && <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />}
                    {state === 'reviewing' && isSelected && !isCorrectOption && <XCircle className="w-5 h-5 text-red-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {state === 'reviewing' && (
              <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 p-4 rounded-xl mb-6 shadow-inner">
                <span className="font-bold text-slate-800 block mb-1">Explanation:</span>
                {currentQuestion.explanation}
              </div>
            )}

            <div className="flex justify-end">
              {state === 'answering' ? (
                <button
                  disabled={selectedOption === null}
                  onClick={handleSubmit}
                  className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Submit Answer
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
                >
                  {currentQ < questions.length - 1 ? 'Next Question' : 'See Results'}
                </button>
              )}
            </div>
          </div>
        )}

        {state === 'complete' && (() => {
          const passed = score >= 2;
          return (
            <div className={`p-8 rounded-2xl text-center shadow-sm border ${passed ? 'bg-green-50 border-green-100' : 'bg-orange-50 border-orange-100'} animate-in fade-in zoom-in-95 duration-500`}>
              <div className="text-5xl font-extrabold mb-4 text-slate-800">{score} / {questions.length}</div>
              <p className={`font-semibold text-lg mb-8 ${passed ? 'text-green-800' : 'text-orange-800'}`}>
                {passed ? '🎉 Great job! Chapter unlocked.' : '📚 Review the material and try again.'}
              </p>
              <button
                onClick={handleRetake}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm hover:border-slate-300"
              >
                <RotateCcw className="w-4 h-4" /> Retake Quiz
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
