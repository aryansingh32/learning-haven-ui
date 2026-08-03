import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface OptionButtonProps {
  label: string;
  value?: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  label,
  selected,
  onClick,
  icon,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full min-h-[4rem] sm:min-h-[4.5rem] px-5 sm:px-6 border-2 rounded-2xl flex items-center gap-4 text-left transition-all duration-300 ease-out ${selected
          ? "border-blue-600 bg-blue-50/80 text-blue-700 shadow-md shadow-blue-900/5 -translate-y-0.5"
          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/5 hover:-translate-y-0.5 pointer-events-auto"
        }`}
    >
      <div className="shrink-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
        {selected ? (
          <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 drop-shadow-sm" />
        ) : (
          <Circle className="w-6 h-6 sm:w-7 sm:h-7 text-gray-300 group-hover:text-blue-300 transition-colors" />
        )}
      </div>

      {icon && (
        <span className="text-2xl sm:text-3xl flex-shrink-0 drop-shadow-sm">
          {icon}
        </span>
      )}
      <span className={`truncate flex-1 text-base sm:text-lg ${selected ? 'font-semibold' : 'font-medium'}`}>
        {label}
      </span>
    </button>
  );
};
