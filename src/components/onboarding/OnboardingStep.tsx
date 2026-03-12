import React from 'react';
import { OptionButton } from './OptionButton';

interface OnboardingStepProps {
  question: string;
  options: { label: string; value: string; icon?: string }[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
}

export const OnboardingStep: React.FC<OnboardingStepProps> = ({
  question,
  options,
  selectedValue,
  onSelect,
}) => {
  return (
    <div className="w-full flex flex-col items-center justify-center h-full px-6 sm:px-12">
      <div className="w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-center mb-10 sm:mb-12 leading-tight">
          {question}
        </h2>
        <div className="space-y-4 sm:space-y-5">
          {options.map((opt) => (
            <OptionButton
              key={opt.value}
              label={opt.label}
              selected={selectedValue === opt.value}
              onClick={() => onSelect(opt.value)}
              icon={opt.icon}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
