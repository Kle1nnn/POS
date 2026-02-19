"use client";
import React from "react";
import { Product } from "./Product";
import { useCart } from "../context/CartContext";
interface RollCardProps {
  product: Product;
}

export default function RollCard({ product }: RollCardProps) {
  const { addToCart } = useCart();

  const handleAddToBilling = () => {
    const orderItem = {
      ...product,
      selectedSize: "N/A",
      selectedTopping: "None",
      selectedSauce: "None",
    };
    addToCart(orderItem);
    console.log("Added to billing:", orderItem);
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Product Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-yellow-700 to-yellow-500">
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
            ${product.price.toFixed(2)}
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
