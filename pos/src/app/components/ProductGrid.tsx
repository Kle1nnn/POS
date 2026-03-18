"use client";
import React from "react";
import { Product } from "./Product";
import { useCategory } from "../context/CategoryContext";
import { products } from "../data/products";

import PizzaCard from "./card/PizzaCard";
import BurgerCard from "./card/BurgerCard";
import RollCard from "./card/RollCard";
import FriesCard from "./card/FriesCard";
import DrinksCard from "./card/DrinksCard";

const CATEGORY_ORDER = [
  "Pizza",
  "Burger",
  "Broast",
  "Rolls",
  "Fries",
  "Drinks",
  "Extras",
];

interface ProductGridProps {
  searchQuery?: string;
}

export default function ProductGrid({ searchQuery = "" }: ProductGridProps) {
  const { selectedCategory } = useCategory();

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "ALL" || product.category === selectedCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const productsByCategory = filteredProducts.reduce(
    (acc, product) => {
      if (!acc[product.category]) acc[product.category] = [];
      acc[product.category].push(product);
      return acc;
    },
    {} as { [key: string]: Product[] },
  );

  // Sort items within each category alphabetically
  Object.values(productsByCategory).forEach((arr) =>
    arr.sort((a, b) => a.name.localeCompare(b.name)),
  );

  // Sort categories in defined order
  const sortedCategories = Object.keys(productsByCategory).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b),
  );

  const renderCard = (product: Product) => {
    switch (product.category) {
      case "Pizza":
        return <PizzaCard key={product.id} product={product} />;
      case "Burger":
        return <BurgerCard key={product.id} product={product} />;
      case "Rolls":
        return <RollCard key={product.id} product={product} />;
      case "Fries":
        return <FriesCard key={product.id} product={product} />;
      case "Drinks":
        return <DrinksCard key={product.id} product={product} />;
      default:
        return <BurgerCard key={product.id} product={product} />;
    }
  };

  if (filteredProducts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No products found
      </div>
    );
  }

  return (
    <div className="py-4 px-4">
      {sortedCategories.map((category) => (
        <div key={category} className="mb-6">
          {/* Category header */}
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
              {category}
            </h2>
            <div className="flex-1 h-px bg-[#f1e5d8]" />
            <span className="text-xs text-gray-400">
              {productsByCategory[category].length} items
            </span>
          </div>

          {/* Cards grid — 2 cols on small, more on wider */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {productsByCategory[category].map((product) => renderCard(product))}
          </div>
        </div>
      ))}
    </div>
  );
}
