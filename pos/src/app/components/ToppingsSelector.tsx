"use client";
import React from "react";

type Option = {
  value: string;
  label: string;
};

interface ToppingsSelectorProps {
  label: string;
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
  layout?: "row" | "col";
  activeColor?: string;
}

export default function ToppingsSelector({
  label,
  options,
  selected,
  onSelect,
  layout = "row",
  activeColor = "bg-amber-900",
}: ToppingsSelectorProps) {
  const isColumn = layout === "col";

  return (
    <div>
      <div className="text-[0.7rem] font-medium text-gray-600 mb-1">
        {label}
      </div>
      <div
        className={`flex ${isColumn ? "flex-col gap-1.5" : "flex-wrap gap-1.5"}`}
      >
        {options.map((option) => {
          const isActive = option.value === selected;
          return (
            <button
              key={option.value || option.label}
              type="button"
              onClick={() => onSelect(option.value)}
              className={[
                "w-8 h-8 flex items-center justify-center text-[0.65rem] font-medium rounded-full border transition-colors",
                isActive
                  ? `${activeColor} border-transparent text-white shadow-sm`
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
