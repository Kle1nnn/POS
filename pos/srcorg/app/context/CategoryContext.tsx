"use client";
import React, { createContext, useContext, useState } from "react";

interface CategoryContextType {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}
const CategoryContext = createContext<CategoryContextType | undefined>(
  undefined,
);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [selectedCategory, sestSelectedCategory] = useState<string>("ALL");
  return (
    <CategoryContext.Provider
      value={{
        selectedCategory,
        setSelectedCategory: sestSelectedCategory,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}
export function useCategory() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error("useCategory must be used within a CategoryProvider");
  }
  return context;
}
