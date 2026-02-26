"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart } from "../../context/CartContext";

interface DrinksCardProps {
  product: Product;
}

export default function DrinksCard({ product }: DrinksCardProps) {
  const { addToCart } = useCart();

  const [selectedSize, setSelectedSize] = useState<string>("Regular");

  const handleAddToBilling = () => {
    addToCart({
      ...product,
      price: product.basePrice,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-600 to-blue-400" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900 mb-0.5">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-1">
            {product.description}
          </p>
          <p className="text-lg font-bold text-gray-900">
            ${product.basePrice.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-700 mb-2 block">
          Size
        </label>
        <div className="flex gap-2">
          {["Small", "Regular", "Large"].map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedSize === size
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleAddToBilling}
        className="w-full bg-amber-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-800 transition-colors"
      >
        Add to Billing
      </button>
    </div>
  );
}
