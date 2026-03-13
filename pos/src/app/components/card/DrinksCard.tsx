"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";
import ToppingsSelector from "../ToppingsSelector";

interface DrinksCardProps {
  product: Product;
}

const DRINK_SIZE_PRICES: Record<string, number> = {
  Small: 0,
  Regular: 50,
  Large: 100,
};

const SIZE_OPTIONS = [
  { value: "Small", label: "Small" },
  { value: "Regular", label: "Regular" },
  { value: "Large", label: "Large" },
];

export default function DrinksCard({ product }: DrinksCardProps) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState("Regular");

  const finalPrice = product.basePrice + DRINK_SIZE_PRICES[selectedSize];

  const handleAddToBilling = () => {
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id, selectedSize),
      selectedSize,
      price: finalPrice,
    });
  };

  return (
    <div className="bg-[#fdfaf7] rounded-3xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col border border-[#f1e5d8]">
      <div className="w-full h-28 rounded-2xl bg-[url('/coffee-placeholder.png')] bg-cover bg-center mb-3 bg-[#d3e3f6]" />

      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-900 mb-0.5">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{product.description}</p>
        <p className="text-lg font-bold text-gray-900 tracking-tight">
          Rs. {finalPrice.toFixed(0)}
        </p>
      </div>

      <div className="space-y-2.5 mb-3">
        <ToppingsSelector
          label="Size"
          options={SIZE_OPTIONS}
          selected={selectedSize}
          onSelect={setSelectedSize}
          activeColor="bg-blue-600"
        />
      </div>

      <button
        onClick={handleAddToBilling}
        className="mt-auto w-full bg-[#5b3722] text-white py-3 rounded-2xl font-semibold text-sm hover:bg-[#4a2d1b] transition-colors"
      >
        Add to Billing
      </button>
    </div>
  );
}
