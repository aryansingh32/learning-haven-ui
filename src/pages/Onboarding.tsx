import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useAuth } from '@/context/AuthContext';

import { useApiQuery } from '@/hooks/useApi';
import { Loader2 } from 'lucide-react';

// Steps will be loaded dynamically from API

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useApiQuery<any>(
    ['public-settings'],
    '/settings/public'
  );

  const dynamicSteps = settings?.onboarding_steps || [];

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSelect = (value: string) => {
    if (!dynamicSteps.length) return;
    setAnswers((prev) => ({ ...prev, [dynamicSteps[currentStep].id]: value }));
  };

  const currentSelection = dynamicSteps.length > 0 ? answers[dynamicSteps[currentStep].id] : null;

  const handleNext = () => {
    if (currentStep < dynamicSteps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      localStorage.setItem('dsa_os_onboarding', JSON.stringify({
        year: answers.year || '',
        goal: answers.goal || '',
        hours_per_day: answers.hours || '',
        language: answers.language || ''
      }));
      navigate('/roadmap-preview');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const progressPercentage = dynamicSteps.length > 0 ? ((currentStep + 1) / dynamicSteps.length) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (dynamicSteps.length === 0) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center flex-col">
        <h2 className="text-xl font-bold">Onboarding not configured</h2>
        <button onClick={() => navigate('/dashboard')} className="mt-4 text-blue-600 underline">Skip</button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white sm:bg-slate-50 flex flex-col relative overflow-hidden font-sans">
      {/* Decorative background blobs for desktop */}
      <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
      <div className="hidden sm:block absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />

      <div className="flex-1 w-full sm:max-w-4xl mx-auto flex flex-col justify-center relative z-10 sm:p-6 md:p-10 min-h-[100dvh] sm:min-h-0">
        <div className="bg-white sm:shadow-2xl sm:shadow-slate-200/50 sm:rounded-[2.5rem] flex flex-col w-full h-full sm:h-[750px] overflow-hidden sm:border border-slate-100/60 relative">

          {/* Header & Progress */}
          <div className="pt-6 sm:pt-8 px-6 sm:px-12 z-20 bg-white sm:bg-transparent">
            <div className="flex items-center justify-between h-12 mb-6 relative">
              {currentStep > 0 ? (
                <button
                  onClick={handleBack}
                  className="p-2 sm:p-3 -ml-2 sm:-ml-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-all duration-200 active:scale-95 z-10"
                >
                  <ArrowLeft className="w-6 h-6 sm:w-7 sm:h-7" />
                </button>
              ) : (
                <div className="w-10 sm:w-12"></div>
              )}

              <div className="text-sm sm:text-base font-semibold text-slate-400 absolute left-1/2 -translate-x-1/2 tracking-widest uppercase">
                Step {currentStep + 1} of {dynamicSteps.length}
              </div>
            </div>

            <div className="w-full h-2 sm:h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-blue-600 sm:bg-gradient-to-r sm:from-blue-500 sm:to-indigo-600 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Steps Content Area (Sliding) */}
          <div className="flex-1 relative flex items-center h-full w-full overflow-hidden mt-4 sm:mt-0">
            <div
              className="flex w-full transition-transform duration-500 ease-in-out h-full items-center will-change-transform"
              style={{ transform: `translateX(-${currentStep * 100}%)` }}
            >
              {dynamicSteps.map((step: any) => (
                <div key={step.id} className="w-full shrink-0 flex items-center justify-center h-full pb-20 sm:pb-24">
                  <OnboardingStep
                    question={step.question}
                    options={step.options}
                    selectedValue={answers[step.id] || null}
                    onSelect={handleSelect}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="absolute bottom-0 left-0 w-full p-6 sm:p-10 sm:px-12 bg-white sm:bg-gradient-to-t sm:from-white sm:via-white sm:to-transparent pt-4 sm:pt-12 sm:border-none border-t border-slate-100">
            <div className="w-full max-w-xl mx-auto flex justify-end">
              <button
                onClick={handleNext}
                disabled={!currentSelection}
                className={`flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[200px] h-14 sm:h-16 rounded-2xl font-bold text-lg transition-all duration-300 ${currentSelection
                  ? 'bg-blue-600 text-white sm:shadow-xl sm:shadow-blue-600/20 hover:bg-blue-700 hover:-translate-y-1 hover:shadow-blue-600/30 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed hidden sm:flex opacity-0'
                  }`}
                style={{
                  opacity: currentSelection ? 1 : 0,
                  transform: currentSelection ? 'translateY(0)' : 'translateY(10px)',
                  pointerEvents: currentSelection ? 'auto' : 'none',
                }}
              >
                <span>{currentStep === dynamicSteps.length - 1 ? 'Finish & View Roadmap' : 'Continue'}</span>
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 hidden sm:block" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Onboarding;
