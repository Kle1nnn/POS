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
      if (!acc[product.category]) {
        acc[product.category] = [];
      }
      acc[product.category].push(product);
      return acc;
    },
    {} as { [key: string]: Product[] },
  );

  const renderProductCard = (product: Product) => {
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

  return (
    <div className="py-6 px-6">
      {Object.entries(productsByCategory).map(
        ([category, categoryProducts]) => (
          <div key={category} className="mb-8">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {category} Menu
              </h2>
              <span className="text-xs text-gray-400">
                {categoryProducts.length} items
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {categoryProducts.map((product) => renderProductCard(product))}
            </div>
          </div>
        ),
      )}

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No products found
        </div>
      )}
    </div>
  );
}
