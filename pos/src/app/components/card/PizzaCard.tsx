"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";

interface PizzaCardProps {
  product: Product;
}

export default function PizzaCard({ product }: PizzaCardProps) {
  const { addToCart } = useCart();
  const availableSizes = product.sizes?.length
    ? product.sizes
    : ["S", "M", "L"];
  const [selectedSize, setSelectedSize] = useState(availableSizes[0]);

  const sizePrice = product.sizePrices?.[selectedSize] ?? product.basePrice;

  const handleAdd = () => {
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id, selectedSize),
      selectedSize,
      selectedTopping: "None",
      selectedSauce: "None",
      price: sizePrice,
    });
  };

  const SIZE_STYLE: Record<
    string,
    { dot: string; active: string; inactive: string }
  > = {
    S: {
      dot: "w-2 h-2",
      active: "bg-[#2d7a2d] text-white border-[#2d7a2d]",
      inactive: "bg-white text-[#2d7a2d] border-[#c8e6c9] hover:bg-[#f0faf0]",
    },
    M: {
      dot: "w-3 h-3",
      active: "bg-[#2d7a2d] text-white border-[#2d7a2d]",
      inactive: "bg-white text-[#2d7a2d] border-[#c8e6c9] hover:bg-[#f0faf0]",
    },
    L: {
      dot: "w-4 h-4",
      active: "bg-[#2d7a2d] text-white border-[#2d7a2d]",
      inactive: "bg-white text-[#2d7a2d] border-[#c8e6c9] hover:bg-[#f0faf0]",
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-[#f1e5d8] shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden">
      {/* Image */}
      <div
        className="w-full h-24 bg-cover bg-center bg-[#f5ede3]"
        style={{ backgroundImage: `url('/${product.image || "pizzaa.png"}')` }}
      />

      {/* Name + price */}
      <div className="px-3 pt-2 pb-1">
        <h3 className="font-semibold text-xs text-gray-900 leading-tight line-clamp-2 min-h-[2.2rem]">
          {product.name}
        </h3>
        <p className="text-sm font-bold text-[#5b3722] mt-0.5">
          Rs. {sizePrice.toFixed(0)}
        </p>
      </div>

      {/* Size selector */}
      <div className="px-3 pb-2">
        <p className="text-[0.6rem] text-gray-400 font-medium mb-1.5 uppercase tracking-wide">
          Size
        </p>
        <div className="flex gap-1.5">
          {availableSizes.map((size) => {
            const isActive = selectedSize === size;
            const s = SIZE_STYLE[size] ?? SIZE_STYLE["M"];
            return (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`flex-1 h-9 rounded-xl text-[0.7rem] font-bold transition-all border flex items-center justify-center gap-1.5
                  ${isActive ? s.active : s.inactive}`}
              >
                {/* Visual dot showing relative size */}
                <span
                  className={`rounded-full flex-shrink-0 ${s.dot} ${isActive ? "bg-white/60" : "bg-[#2d7a2d]/30"}`}
                />
                {size}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleAdd}
        className="mx-3 mb-3 py-2 rounded-xl bg-[#5b3722] text-white text-xs font-semibold hover:bg-[#4a2d1b] transition-colors"
      >
        + Add
      </button>
    </div>
  );
}
