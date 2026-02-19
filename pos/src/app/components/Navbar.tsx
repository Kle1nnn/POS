"use client";

import React from "react";
import { useCategory } from "../context/CategoryContext";
export default function Navbar() {
  const { selectedCategory, setSelectedCategory } = useCategory();
  const Menu = ["ALL", "Pizza", "Burger", "Rolls", "Fries", "Drinks"];

  return (
    <div className="flex justify-between px-4 py-8 h-25 w-full">
      {Menu.map((item, index) => (
        <div
          key={index}
          onClick={() => setSelectedCategory(item)}
          className={`shrink h-20 w-18 shadow-2xs rounded-2xl flex items-center justify-center cursor-pointer transition ease-in-out duration-300 ${
            selectedCategory === item
              ? "bg-amber-600 text-white border-2 border-amber-700"
              : "bg-white hover:bg-lightpink hover:border border-brown"
          }`}
        >
          {item}
        </div>
      ))}
    </div>
  );
}
