"use client";

import React from "react";
import { useCategory } from "../context/CategoryContext";
export default function Navbar() {
  const { selectedCategory, setSelectedCategory } = useCategory();
  const Menu = ["ALL", "Pizza", "Burger", "Rolls", "Fries", "Drinks"];

  return (
    <div className="flex gap-3 px-6 py-6 w-full overflow-x-auto">
      {Menu.map((item, index) => (
        <div
          key={index}
          onClick={() => setSelectedCategory(item)}
          className={`shrink-0 px-4 py-2 rounded-full text-sm cursor-pointer border transition-colors duration-200 ${
            selectedCategory === item
              ? "bg-[#5b3722] text-white border-[#5b3722] shadow-sm"
              : "bg-white text-gray-700 border-[#f1e5d8] hover:bg-[#f8efe5]"
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
