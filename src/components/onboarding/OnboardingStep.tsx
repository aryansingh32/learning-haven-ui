import React, { useEffect, useState } from "react";
import { OptionButton } from "./OptionButton";

export interface OnboardingOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface OnboardingStepProps {
  step: number;
  totalSteps: number;
  title: string;
  options: OnboardingOption[];
  value: string | null;
  onChange: (value: string) => void;
  onNext: () => void;
  onBack?: () => void;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  step,
  totalSteps,
  title,
  options,
  value,
  onChange,
  onNext,
  onBack,
}) => {
  const progress = (step / totalSteps) * 100;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation after mount
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [step]);

  return (
    <div
      className={[
        "w-full",
        "transform transition-transform duration-300 ease-out",
        mounted ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {/* Top bar: back + progress */}
      <div className="flex items-center justify-between mb-6">
        <div className="w-16">
          {step > 1 && onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Back
            </button>
          )}
        </div>
        <div className="flex-1 mx-3">
          <div className="w-full h-1 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div className="w-10 text-right text-xs text-gray-400">
          {step}/{totalSteps}
        </div>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {title}
      </h1>

      <div className="space-y-3 mb-8">
        {options.map((opt) => (
          <OptionButton
            key={opt.value}
            label={opt.label}
            value={opt.value}
            icon={opt.icon}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>

      {value && (
        <button
          type="button"
          onClick={onNext}
          className="w-full h-12 bg-blue-600 text-white rounded-xl text-sm font-semibold shadow-md hover:bg-blue-700 transition-colors"
        >
          {step === totalSteps ? "Finish" : "Next"}
        </button>
      )}
    </div>
  );
};

