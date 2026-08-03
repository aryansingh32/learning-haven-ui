import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Sparkles, Rocket, Briefcase, TrendingUp, Target, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApiQuery } from '@/hooks/useApi';
import { api } from '@/services/api.svc';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Career Track Definitions ─────────────────────────────────────────────────
const CAREER_TRACKS = [
  {
    value: 'backend',
    label: 'Backend Developer',
    emoji: '⚙️',
    desc: 'APIs, databases, system design',
    salary: '₹6-15 LPA',
    skills: ['Arrays', 'Strings', 'Trees', 'Graphs', 'SQL', 'System Design'],
    companies: ['Amazon', 'Flipkart', 'Google'],
    color: 'from-blue-500 to-indigo-600',
  },
  {
    value: 'frontend',
    label: 'Frontend Developer',
    emoji: '🎨',
    desc: 'React, UI/UX, web performance',
    salary: '₹5-14 LPA',
    skills: ['Arrays', 'Strings', 'DOM', 'React Patterns', 'CSS'],
    companies: ['Google', 'Swiggy', 'Razorpay'],
    color: 'from-emerald-500 to-teal-600',
  },
  {
    value: 'fullstack',
    label: 'Full-Stack Developer',
    emoji: '🚀',
    desc: 'End-to-end product building',
    salary: '₹8-18 LPA',
    skills: ['Arrays', 'Trees', 'Graphs', 'APIs', 'Databases', 'System Design'],
    companies: ['Microsoft', 'Amazon', 'Uber'],
    color: 'from-purple-500 to-violet-600',
  },
  {
    value: 'dsa_interview',
    label: 'DSA Interview Prep',
    emoji: '🎯',
    desc: 'Crack coding interviews fast',
    salary: '₹4-12 LPA',
    skills: ['Arrays', 'Strings', 'LinkedList', 'Trees', 'DP', 'Graphs'],
    companies: ['TCS', 'Infosys', 'Wipro', 'Accenture'],
    color: 'from-orange-500 to-amber-600',
  },
  {
    value: 'faang',
    label: 'FAANG Preparation',
    emoji: '🏆',
    desc: 'Target top-tier tech companies',
    salary: '₹20-50 LPA',
    skills: ['Advanced DP', 'Graphs', 'System Design', 'Trees', 'Bit Manipulation'],
    companies: ['Google', 'Meta', 'Apple', 'Amazon'],
    color: 'from-rose-500 to-pink-600',
  },
];

const fallbackSteps = [
  {
    id: 'level',
    question: 'Where are you right now?',
    subtitle: 'This helps us find the right starting point for you.',
    options: [
      { label: 'Complete Beginner', emoji: '🌱', value: 'beginner', desc: 'Never coded or just started' },
      { label: 'Know basics but stuck', emoji: '🔄', value: 'intermediate', desc: 'Can code but DSA feels hard' },
      { label: 'Preparing for placements', emoji: '🎯', value: 'advanced', desc: 'Need structured practice' },
    ],
  },
  {
    id: 'career_track',
    question: 'What career are you building toward?',
    subtitle: 'We\'ll generate a personalized roadmap for this role.',
    isCareerStep: true,
    options: CAREER_TRACKS,
  },
  {
    id: 'goal',
    question: "What's your primary goal?",
    subtitle: "We'll customize your learning intensity based on this.",
    options: [
      { label: 'Get a Job', emoji: '💼', value: 'job', desc: 'Crack placement interviews' },
      { label: 'Crack FAANG', emoji: '🚀', value: 'faang', desc: 'Top tech companies' },
      { label: 'Build Projects', emoji: '🛠', value: 'projects', desc: 'Apply DSA in real apps' },
      { label: 'Just Learn Properly', emoji: '📚', value: 'learn', desc: 'Strong fundamentals' },
    ],
  },
  {
    id: 'time',
    question: 'How much time can you give daily?',
    subtitle: "Don't worry, even 30 minutes works.",
    options: [
      { label: '30 minutes', emoji: '⏱', value: '30min', desc: 'Quick focused sessions' },
      { label: '1 hour', emoji: '⏰', value: '1hr', desc: 'Ideal pace for most' },
      { label: '2+ hours', emoji: '🔥', value: '2hr+', desc: 'Intense sprint mode' },
    ],
  },
  {
    id: 'reminders',
    question: 'Should we hold you accountable?',
    subtitle: 'Consistency is everything. We can send you a weekly push.',
    options: [
      { label: 'Yes, remind me via Email', emoji: '💌', value: 'email', desc: 'Send me a weekly progress report' },
      { label: 'No, I can manage myself', emoji: '🔕', value: 'none', desc: 'I will rely on my own discipline' },
    ],
  },
];

const getRecommendation = (answers: Record<string, string>) => {
  const time = answers.time;
  const level = answers.level;
  const careerTrack = CAREER_TRACKS.find(t => t.value === answers.career_track);
  let weeks = 12;
  let startPhase = 'Phase 1';

  if (time === '1hr') weeks = 8;
  if (time === '2hr+') weeks = 5;
  if (level === 'intermediate') { startPhase = 'Phase 1, Chapter 3'; weeks = Math.max(weeks - 3, 3); }
  if (level === 'advanced') { startPhase = 'Phase 2'; weeks = Math.max(weeks - 5, 3); }

  return {
    startPhase,
    weeks,
    careerTrack: careerTrack || CAREER_TRACKS[3],
  };
};

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);

  // Keep the existing API query for dynamic steps
  const { data: settings, isLoading } = useApiQuery<any>(
    ['public-settings'],
    '/settings/public'
  );

  const apiSteps = settings?.onboarding_steps || [];
  const steps = apiSteps.length >= 3 ? apiSteps : fallbackSteps;

  useEffect(() => {
    // If not authenticated, send them to sign up first
    if (!isAuthenticated) {
      navigate('/signup', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSelect = (value: string) => {
    setAnswers((prev) => ({ ...prev, [steps[currentStep].id]: value }));
  };

  const currentSelection = answers[steps[currentStep]?.id];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowResult(true);
      // Persist onboarding data to database
      const onboardingData = {
        career_track: answers.career_track || '',
        learning_goal: answers.goal || '',
        daily_time_minutes: answers.time === '30min' ? 30 : answers.time === '1hr' ? 60 : 120,
        onboarding_completed: true,
        onboarding_answers: {
          level: answers.level || '',
          goal: answers.goal || '',
          hours_per_day: answers.time || '',
          career_track: answers.career_track || '',
          reminders: answers.reminders || '',
        },
      };
      api.patch('/users/me/profile', onboardingData).catch((err: any) => {
        console.error('Failed to persist onboarding:', err);
      });
      // Also keep localStorage as fallback
      localStorage.setItem('forge_onboarding', JSON.stringify(onboardingData.onboarding_answers));
    }
  };

  const handleBack = () => {
    if (showResult) {
      setShowResult(false);
    } else if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progressPercentage = showResult ? 100 : ((currentStep + 1) / steps.length) * 100;
  const recommendation = getRecommendation(answers);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white sm:bg-slate-50 flex flex-col relative overflow-hidden font-sans">
      {/* Background blobs */}
      <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-amber-500/5 blur-[100px] pointer-events-none" />

      <div className="flex-1 w-full sm:max-w-2xl mx-auto flex flex-col justify-center relative z-10 sm:p-6 md:p-10 min-h-[100dvh] sm:min-h-0">
        <div className="bg-white sm:shadow-2xl sm:shadow-slate-200/50 sm:rounded-[2rem] flex flex-col w-full h-full sm:h-auto overflow-hidden sm:border border-slate-100/60 relative">

          {/* Header & Progress */}
          <div className="pt-6 sm:pt-8 px-6 sm:px-10 bg-white">
            <div className="flex items-center justify-between h-10 mb-5">
              {(currentStep > 0 || showResult) ? (
                <button
                  onClick={handleBack}
                  className="p-2 -ml-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-all active:scale-95"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              ) : (
                <div className="w-9" />
              )}
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {showResult ? 'Your Career Plan' : `${currentStep + 1} of ${steps.length}`}
              </span>
              <div className="w-9" />
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 px-6 sm:px-10 py-8 sm:py-10 overflow-y-auto">
            <AnimatePresence mode="wait">
              {showResult ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center"
                >
                  <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${recommendation.careerTrack.color} flex items-center justify-center mb-5 shadow-lg`}>
                    <Rocket className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-2">
                    Your {recommendation.careerTrack.label} plan is ready! ✨
                  </h2>
                  <p className="text-sm text-slate-500 leading-relaxed mb-5 max-w-md mx-auto">
                    Starting with <strong className="text-slate-900">{recommendation.startPhase}</strong>,
                    completable in <strong className="text-slate-900">{recommendation.weeks} weeks</strong>.
                  </p>

                  {/* Career Outcome Preview */}
                  <div className="bg-slate-50 rounded-2xl p-5 text-left mb-6 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <Target className="w-3 h-3" /> Career Outcome Preview
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="rounded-xl bg-white p-3 border border-slate-100 text-center">
                        <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-slate-900">{recommendation.careerTrack.salary}</p>
                        <p className="text-[10px] text-slate-400">Expected Salary</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 border border-slate-100 text-center">
                        <Zap className="w-4 h-4 text-orange-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-slate-900">{recommendation.careerTrack.skills.length}</p>
                        <p className="text-[10px] text-slate-400">Skills to Master</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {recommendation.careerTrack.skills.slice(0, 5).map(s => (
                        <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">{s}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Target: {recommendation.careerTrack.companies.join(', ')}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      // Navigate to dashboard and force first_time experience
                      navigate('/dashboard?first_time=true');
                    }}
                    className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-bold rounded-2xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 hover:-translate-y-0.5 transition-all"
                  >
                    Start My Journey <ArrowLeft className="inline-block ml-2 w-4 h-4 rotate-180" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
                    {steps[currentStep].question}
                  </h2>
                  <p className="text-sm text-slate-400 mb-6">
                    {steps[currentStep].subtitle || 'Choose the option that fits you best.'}
                  </p>

                  {/* Career Track Step — special layout */}
                  {steps[currentStep].isCareerStep ? (
                    <div className="space-y-3">
                      {CAREER_TRACKS.map((track) => {
                        const isSelected = currentSelection === track.value;
                        return (
                          <motion.button
                            key={track.value}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelect(track.value)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-orange-400 bg-orange-50 shadow-sm'
                                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{track.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${isSelected ? 'text-orange-700' : 'text-slate-900'}`}>
                                  {track.label}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5">{track.desc}</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">
                                    {track.salary}
                                  </span>
                                  <span className="text-[10px] text-slate-300">•</span>
                                  <span className="text-[10px] text-slate-400">
                                    {track.companies.slice(0, 2).join(', ')}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0"
                                >
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  ) : (
                    /* Standard options */
                    <div className="space-y-3">
                      {(steps[currentStep].options || []).map((option: any) => {
                        const value = option.value || option.label;
                        const isSelected = currentSelection === value;
                        return (
                          <motion.button
                            key={value}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelect(value)}
                            className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
                              isSelected
                                ? 'border-orange-400 bg-orange-50 shadow-sm'
                                : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{option.emoji || '📌'}</span>
                              <div className="flex-1">
                                <p className={`text-sm font-bold ${isSelected ? 'text-orange-700' : 'text-slate-900'}`}>
                                  {option.label}
                                </p>
                                {option.desc && (
                                  <p className="text-xs text-slate-400 mt-0.5">{option.desc}</p>
                                )}
                              </div>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center"
                                >
                                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom CTA */}
          {!showResult && (
            <div className="px-6 sm:px-10 pb-6 sm:pb-8">
              <AnimatePresence>
                {currentSelection && (
                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 12 }}
                    onClick={handleNext}
                    className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl font-bold text-base shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    {currentStep === steps.length - 1 ? 'See My Career Plan' : 'Continue'}
                    <ChevronRight className="w-5 h-5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
