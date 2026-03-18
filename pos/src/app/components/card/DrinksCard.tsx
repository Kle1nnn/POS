"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";

interface DrinksCardProps {
  product: Product;
}

const DRINK_SIZES = [
  { label: "Sm", value: "Small", extra: 0 },
  { label: "Reg", value: "Regular", extra: 50 },
  { label: "Lg", value: "Large", extra: 100 },
];

export default function DrinksCard({ product }: DrinksCardProps) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState("Regular");
  const extra = DRINK_SIZES.find((s) => s.value === selectedSize)?.extra ?? 0;
  const finalPrice = product.basePrice + extra;

  const handleAdd = () => {
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id, selectedSize),
      selectedSize,
      price: finalPrice,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-[#f1e5d8] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
      <div
        className="w-full h-24 bg-cover bg-center bg-[#e8f0fa]"
        style={{ backgroundImage: `url('/${product.image || "drink.png"}')` }}
      />
      <div className="px-3 pt-2 pb-1">
        <h3 className="font-semibold text-xs text-gray-900 leading-tight line-clamp-2 min-h-[2.2rem]">
          {product.name}
        </h3>
        <p className="text-sm font-bold text-[#5b3722] mt-0.5">
          Rs. {finalPrice.toFixed(0)}
        </p>
      </div>

      <div className="px-3 pb-1">
        <p className="text-[0.6rem] text-gray-400 font-medium mb-1 uppercase tracking-wide">
          Size
        </p>
        <div className="flex gap-1">
          {DRINK_SIZES.map((s) => {
            const isActive = selectedSize === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setSelectedSize(s.value)}
                className={`flex-1 py-1 rounded-lg text-[0.65rem] font-semibold transition-all border
                  ${
                    isActive
                      ? "bg-[#1565c0] text-white border-[#1565c0]"
                      : "bg-[#e8f0fa] text-[#1565c0] border-[#bbdefb] hover:bg-[#dde9f8]"
                  }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="mx-3 mb-3 mt-2 py-2 rounded-xl bg-[#5b3722] text-white text-xs font-semibold hover:bg-[#4a2d1b] transition-colors"
      >
        + Add
      </button>
    </div>
  );
}
