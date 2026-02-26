"use client";
import React from "react";
import { Product } from "../Product";
import { useCart } from "../../context/CartContext";
interface FriesCardProps {
  product: Product;
}

export default function FriesCard({ product }: FriesCardProps) {
  const { addToCart } = useCart();

  const handleAddToBilling = () => {
    addToCart({
      ...product,
      price: product.basePrice,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Product Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-yellow-600 to-yellow-400">
          {/* Image placeholder */}
        </div>
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

      {/* Add to Billing Button */}
      <button
        onClick={handleAddToBilling}
        className="w-full bg-amber-900 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-amber-800 transition-colors"
      >
        Add to Billing
      </button>
    </div>
  );
}
