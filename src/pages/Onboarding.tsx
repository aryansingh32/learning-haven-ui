import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { OnboardingStep, OnboardingOption } from "@/components/onboarding/OnboardingStep";

type OnboardingAnswers = {
  year: string | null;
  goal: string | null;
  hours_per_day: string | null;
  language: string | null;
};

const STORAGE_KEY = "dsa_os_onboarding";

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();

  const [step, setStep] = useState<number>(1);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
    if (typeof window === "undefined") return {
      year: null,
      goal: null,
      hours_per_day: null,
      language: null,
    };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          year: null,
          goal: null,
          hours_per_day: null,
          language: null,
        };
      }
      const parsed = JSON.parse(raw) as OnboardingAnswers;
      return {
        year: parsed.year ?? null,
        goal: parsed.goal ?? null,
        hours_per_day: parsed.hours_per_day ?? null,
        language: parsed.language ?? null,
      };
    } catch {
      return {
        year: null,
        goal: null,
        hours_per_day: null,
        language: null,
      };
    }
  });

  // Redirect logged-in users straight to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Persist answers whenever they change
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  }, [answers]);

  const totalSteps = 4;

  const { title, options, currentKey } = useMemo(() => {
    switch (step) {
      case 1:
        return {
          title: "Which year are you in?",
          currentKey: "year" as const,
          options: [
            { value: "1st Year", label: "1st Year" },
            { value: "2nd Year", label: "2nd Year" },
            { value: "3rd Year", label: "3rd Year" },
            { value: "4th Year / Alumni", label: "4th Year / Alumni" },
          ] as OnboardingOption[],
        };
      case 2:
        return {
          title: "What is your main goal?",
          currentKey: "goal" as const,
          options: [
            { value: "Get a Job", label: "Get a Job" },
            { value: "Get an Internship", label: "Get an Internship" },
            { value: "Clear College Exams", label: "Clear College Exams" },
            { value: "All Three", label: "All Three" },
          ] as OnboardingOption[],
        };
      case 3:
        return {
          title: "How many hours can you study per day?",
          currentKey: "hours_per_day" as const,
          options: [
            { value: "Less than 1 hour", label: "Less than 1 hour" },
            { value: "1-2 hours", label: "1-2 hours" },
            { value: "3-4 hours", label: "3-4 hours" },
            { value: "5+ hours", label: "5+ hours" },
          ] as OnboardingOption[],
        };
      case 4:
      default:
        return {
          title: "Choose your programming language:",
          currentKey: "language" as const,
          options: [
            { value: "Java", label: "Java", icon: "☕" },
            { value: "C++", label: "C++", icon: "⚡" },
            { value: "Python", label: "Python", icon: "🐍" },
            { value: "JavaScript", label: "JavaScript", icon: "🌐" },
          ] as OnboardingOption[],
        };
    }
  }, [step]);

  const currentValue = answers[currentKey];

  const handleChange = (val: string) => {
    setAnswers((prev) => ({
      ...prev,
      [currentKey]: val,
    }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep((s) => s + 1);
      return;
    }
    // Final step completed: ensure we persist and then navigate
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    }
    navigate("/roadmap-preview");
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <OnboardingStep
          step={step}
          totalSteps={totalSteps}
          title={title}
          options={options}
          value={currentValue}
          onChange={handleChange}
          onNext={handleNext}
          onBack={step > 1 ? handleBack : undefined}
        />
      </div>
    </div>
  );
};

export default Onboarding;

