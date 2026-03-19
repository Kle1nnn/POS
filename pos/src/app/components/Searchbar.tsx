"use client";

interface SearchbarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function Searchbar({ value, onChange }: SearchbarProps) {
  return (
    <div className="flex items-center justify-between w-full px-4 pt-4 pb-2">
      <div>
        <div className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">
          Choose Category
        </div>
        <div className="font-bold text-xl text-gray-900 mt-0.5">Menu</div>
      </div>
      <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border border-gray-200 w-60">
        <svg
          className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Enter Product name / SKU"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs text-gray-600 placeholder:text-gray-400 bg-transparent outline-none"
        />
      </div>
    </div>
  );
}
