"use client";
import React from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";

interface BurgerCardProps {
  product: Product;
}

export default function BurgerCard({ product }: BurgerCardProps) {
  const { addToCart } = useCart();

  const handleAddToBilling = () => {
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id),
      price: product.basePrice,
    });
  };

  return (
    <div className="bg-[#fdfaf7] rounded-3xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col border border-[#f1e5d8]">
      <div className="w-full h-28 rounded-2xl bg-[url('/coffee-placeholder.png')] bg-cover bg-center mb-3 bg-[#f1dec9]" />

      <div className="mb-3">
        <h3 className="font-semibold text-sm text-gray-900 mb-0.5">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-1">{product.description}</p>
        <p className="text-lg font-bold text-gray-900 tracking-tight">
          Rs. {product.basePrice.toFixed(0)}
        </p>
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
