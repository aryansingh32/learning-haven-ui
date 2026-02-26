import React from "react";
import { CheckCircle2, Circle } from "lucide-react";

interface OptionButtonProps {
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

export const OptionButton: React.FC<OptionButtonProps> = ({
  label,
  value,
  selected,
  onClick,
  icon,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full h-14 px-4 border-2 rounded-xl flex items-center gap-3 text-left",
        "transition-colors duration-200",
        selected
          ? "border-blue-600 bg-blue-50 text-blue-700 font-medium"
          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
      ].join(" ")}
    >
      <div className="shrink-0 flex items-center justify-center">
        {selected ? (
          <CheckCircle2 className="w-5 h-5 text-blue-600" />
        ) : (
          <Circle className="w-5 h-5 text-gray-300" />
        )}
      </div>

      {icon && (
        <span className="text-xl flex-shrink-0">
          {icon}
        </span>
      )}
      <span className="truncate flex-1">{label}</span>
    </button>
  );
};
