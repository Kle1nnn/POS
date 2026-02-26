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

export default function ProductGrid() {
  const { selectedCategory } = useCategory();

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "ALL" || product.category === selectedCategory;
    return matchesCategory;
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
    <div className="py-6">
      {/* Products Grouped by Category */}
      {Object.entries(productsByCategory).map(
        ([category, categoryProducts]) => (
          <div key={category} className="mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">
              {category}
              <span className="text-sm text-gray-500 ml-2">
                {categoryProducts.length} items
              </span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categoryProducts.map((product) => renderProductCard(product))}
            </div>
          </div>
        ),
      )}

      {/* No Products Found Message */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-gray-500">No products found</div>
      )}
    </div>
  );
}
