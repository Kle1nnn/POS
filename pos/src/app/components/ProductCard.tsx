"use client";

import React from "react";
import { useState } from "react";
import { Product } from "./Product";

interface ProductCardProps {
  product: Product;
}
export default function ProductCard({ product }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState<string>(product.sizes[0]);
  const handleAddToBilling = () => {
    const orderItem = {
      ...product,
      selectedSize,
    };
    console.log("Added to billing:", orderItem);
  };
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Product Image & Info */}
      <div className="flex gap-3 mb-4">
        <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
          {/* Replace with actual Image component when you have images */}
          <div className="w-full h-full bg-gradient-to-br from-amber-900 to-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 mb-1">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2">
            {product.description}
          </p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            ${product.price.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Size Selection */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-700 mb-2 block">
          Size
        </label>
        <div className="flex gap-2">
          {product.sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all ${
                selectedSize === size
                  ? "border-amber-600 bg-amber-50 text-amber-700"
                  : "border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Add to Billing Button */}
      <button
        onClick={handleAddToBilling}
        className="w-full bg-amber-900 text-white py-2.5 rounded-lg font-medium hover:bg-amber-800 transition-colors"
      >
        Add to Billing
      </button>
    </div>
  );
}
