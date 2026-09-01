import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from 'lucide-react';
import type { QuizQuestion } from '@/data/chapters';

interface MiniQuizProps {
  questions: QuizQuestion[];
  onComplete: (passed: boolean) => void;
}

export default function MiniQuiz({ questions, onComplete }: MiniQuizProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">No quiz questions available for this chapter.</p>
        <button
          onClick={() => onComplete(true)}
          className="mt-3 px-4 py-2 gradient-golden text-white rounded-xl text-sm font-bold"
        >
          Skip Quiz
        </button>
      </div>
    );
  }

  const currentQ = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQ.correctIndex;
  const passingScore = Math.ceil(questions.length * 0.6);

  const handleSelectAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    if (index === currentQ.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setScore(0);
    setIsFinished(false);
  };

  if (isFinished) {
    const passed = score >= passingScore;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-4"
      >
        <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
          passed ? 'bg-success/15' : 'bg-destructive/15'
        }`}>
          {passed ? (
            <CheckCircle2 className="w-8 h-8 text-success" />
          ) : (
            <XCircle className="w-8 h-8 text-destructive" />
          )}
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">
          {passed ? '🎉 Quiz Passed!' : 'Almost there!'}
        </h3>
        <p className="text-sm text-muted-foreground mb-1">
          Score: {score}/{questions.length}
        </p>
        <p className="text-xs text-muted-foreground mb-5">
          {passed
            ? 'Great job! You understood the concepts well.'
            : `You need ${passingScore}/${questions.length} to pass. Review the cheatsheet and try again.`}
        </p>
        {passed ? (
          <button
            onClick={() => onComplete(true)}
            className="px-6 py-2.5 gradient-golden text-white rounded-xl text-sm font-bold shadow-md"
          >
            Continue <ArrowRight className="inline-block ml-1 w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleRetry}
            className="px-6 py-2.5 bg-secondary text-foreground rounded-xl text-sm font-bold flex items-center gap-2 mx-auto"
          >
            <RotateCcw className="w-4 h-4" /> Try Again
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
        <span className="text-xs font-bold text-primary">Score: {score}</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <h4 className="text-sm sm:text-base font-bold text-foreground mb-4 leading-relaxed">
            {currentQ.question}
          </h4>
          <div className="space-y-2">
            {currentQ.options.map((option, idx) => {
              let borderClass = 'border-border/50 bg-secondary/30 hover:bg-secondary/50';
              if (showFeedback) {
                if (idx === currentQ.correctIndex) {
                  borderClass = 'border-success bg-success/10';
                } else if (idx === selectedAnswer && !isCorrect) {
                  borderClass = 'border-destructive bg-destructive/10';
                } else {
                  borderClass = 'border-border/30 bg-secondary/20 opacity-50';
                }
              } else if (selectedAnswer === idx) {
                borderClass = 'border-primary bg-primary/10';
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectAnswer(idx)}
                  disabled={showFeedback}
                  className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all text-sm ${borderClass}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      showFeedback && idx === currentQ.correctIndex
                        ? 'bg-success text-white'
                        : showFeedback && idx === selectedAnswer && !isCorrect
                          ? 'bg-destructive text-white'
                          : 'bg-secondary text-muted-foreground'
                    }`}>
                      {showFeedback && idx === currentQ.correctIndex ? '✓' : showFeedback && idx === selectedAnswer && !isCorrect ? '✗' : String.fromCharCode(65 + idx)}
                    </div>
                    <span className="text-foreground">{option}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {showFeedback && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`mt-4 p-3 rounded-xl text-xs leading-relaxed ${
                  isCorrect
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}
              >
                {isCorrect ? '✅ ' : '❌ '}{currentQ.explanation}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {showFeedback && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex justify-end"
        >
          <button
            onClick={handleNext}
            className="px-5 py-2 gradient-golden text-white rounded-xl text-sm font-bold flex items-center gap-2"
          >
            {currentIndex < questions.length - 1 ? 'Next Question' : 'See Results'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
