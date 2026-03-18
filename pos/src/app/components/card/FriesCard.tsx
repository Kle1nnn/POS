"use client";
import React from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";

interface FriesCardProps {
  product: Product;
}

export default function FriesCard({ product }: FriesCardProps) {
  const { addToCart } = useCart();

  const handleAdd = () => {
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id),
      price: product.basePrice,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#f1e5d8] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
      <div
        className="w-full h-24 bg-cover bg-center bg-[#f5ede3]"
        style={{ backgroundImage: `url('/${product.image || "fries.png"}')` }}
      />
      <div className="px-3 pt-2 pb-3 flex-1 flex flex-col">
        <h3 className="font-semibold text-xs text-gray-900 leading-tight line-clamp-2 min-h-[2.2rem]">
          {product.name}
        </h3>
        <p className="text-sm font-bold text-[#5b3722] mt-1 mb-3">
          Rs. {product.basePrice.toFixed(0)}
        </p>
        <button
          onClick={handleAdd}
          className="mt-auto w-full py-2 rounded-xl bg-[#5b3722] text-white text-xs font-semibold hover:bg-[#4a2d1b] transition-colors"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
