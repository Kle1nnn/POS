"use client";
import React from "react";
import ProductCard from "./ProductCard";
import { Product } from "./Product";

const products: Product[] = [
  {
    id: "1",
    name: "Afghani Pizza",
    description: "Delicion Afghani Style Pizza",
    price: 12.99,
    image: "",
    category: "Pizza",
    sizes: ["Small", "Medium", "Large"],
  },
];

export default function ProductGrid() {
  const [selectedCategory, setSelectedCaregory] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  const categories = ["ALL", "Pizza", "Burger", "Rolls", "Fries", "Drinks"];

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      selectedCategory === "ALL" || product.category === selectedCategory;
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
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
              {categoryProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
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
