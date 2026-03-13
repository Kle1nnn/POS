"use client";

interface SearchbarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function Searchbar({ value, onChange }: SearchbarProps) {
  return (
    <div className="flex items-center justify-between w-full px-6 pt-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-[#c3a68c]">
          Choose Category
        </div>
        <div className="font-semibold text-2xl text-gray-900 mt-1">
          Coffee Menu
        </div>
      </div>
      <div className="flex items-center bg-white rounded-full px-4 py-2 shadow-sm border border-[#f1e5d8] w-64">
        <input
          type="text"
          placeholder="Search coffee or menu..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs text-gray-600 placeholder:text-gray-400 bg-transparent outline-none"
        />
      </div>
    </div>
  );
}
