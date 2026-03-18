"use client";

import React from "react";
import { useCategory } from "../context/CategoryContext";

const CATEGORIES = [
  { label: "ALL", emoji: "🍽️" },
  { label: "Pizza", emoji: "🍕" },
  { label: "Burger", emoji: "🍔" },
  { label: "Broast", emoji: "🍗" },
  { label: "Rolls", emoji: "🌯" },
  { label: "Fries", emoji: "🍟" },
  { label: "Drinks", emoji: "🥤" },
  { label: "Extras", emoji: "✨" },
];

export default function Navbar() {
  const { selectedCategory, setSelectedCategory } = useCategory();

  return (
    <div className="flex gap-2 px-4 py-3 w-full overflow-x-auto border-b border-[#f1e5d8] bg-white">
      {CATEGORIES.map((item) => {
        const isActive = selectedCategory === item.label;
        return (
          <button
            key={item.label}
            onClick={() => setSelectedCategory(item.label)}
            className={`shrink-0 flex flex-col items-center justify-center gap-1 w-16 h-16 rounded-2xl text-xs font-semibold transition-all duration-150 border
              ${
                isActive
                  ? "bg-[#5b3722] text-white border-[#5b3722] shadow-md scale-105"
                  : "bg-[#fdfaf7] text-gray-600 border-[#f1e5d8] hover:bg-[#f3e8dc] hover:border-[#d4b99a]"
              }`}
          >
            <span className="text-xl leading-none">{item.emoji}</span>
            <span className="leading-none">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
