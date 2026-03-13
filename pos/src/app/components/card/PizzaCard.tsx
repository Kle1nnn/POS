"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart, makeCartKey } from "../../context/CartContext";
import { toppingsPrice } from "../priceRules";
import ToppingsSelector from "../ToppingsSelector";

interface PizzaCardProps {
  product: Product;
}

const SIZE_OPTIONS = [
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
];

const TOPPING_SIZE_OPTIONS = [
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
];

const TOPPING_TYPE_OPTIONS = [
  { value: "Cheese", label: "Che" },
  { value: "Chicken", label: "Chi" },
  { value: "Mixed", label: "Mixed" },
];

export default function PizzaCard({ product }: PizzaCardProps) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState("S");
  const [selectedToppingSize, setSelectedToppingSize] = useState("");
  const [selectedToppingType, setSelectedToppingType] = useState("");

  const sizePrice = product.sizePrices?.[selectedSize] ?? product.basePrice;
  const toppingPrice = selectedToppingSize
    ? (toppingsPrice[selectedToppingSize] ?? 0)
    : 0;
  const finalPrice = sizePrice + toppingPrice;

  const handleAddToBilling = () => {
    const cartKey = makeCartKey(
      product.id,
      selectedSize,
      `${selectedToppingSize || "None"}-${selectedToppingType || "None"}`,
    );
    addToCart({
      ...product,
      cartKey,
      selectedSize,
      selectedTopping: selectedToppingSize || "None",
      selectedSauce: selectedToppingType || "None",
      price: finalPrice,
    });
  };

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col border border-[#f1e5d8]">
      {/* Top row: image left, text right */}
      <div className="flex gap-3 mb-4">
        <div className="w-20 h-24 rounded-2xl bg-[url('/coffee-placeholder.png')] bg-cover bg-center bg-[#e0d2c4]" />
        <div className="flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-sm text-gray-900 mb-0.5">
              {product.name}
            </h3>
            <p className="text-xs text-gray-500 mb-1">{product.description}</p>
          </div>
          <p className="text-lg font-bold text-gray-900 tracking-tight">
            Rs. {finalPrice.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Options grid: Mood / Size / Sugar(Toppings) / Ice(Toppings Type) */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-6 mb-4">
        {/* Mood */}
        <div>
          <div className="text-[0.7rem] font-medium text-gray-600 mb-1">
            Mood
          </div>
          <div className="flex gap-1.5">
            <div className="w-7 h-7 rounded-full bg-[#ffe6d5] flex items-center justify-center text-xs">
              🔥
            </div>
            <div className="w-7 h-7 rounded-full bg-[#e3f2ff] flex items-center justify-center text-xs">
              ❄️
            </div>
            <div className="w-7 h-7 rounded-full bg-[#ffeef5] flex items-center justify-center text-xs">
              🙂
            </div>
          </div>
        </div>

        {/* Size */}
        <div>
          <ToppingsSelector
            label="Size"
            options={SIZE_OPTIONS.map((s) => ({
              value: s.value,
              label: s.label,
            }))}
            selected={selectedSize}
            onSelect={setSelectedSize}
          />
        </div>

        {/* Sugar -> Toppings size */}
        <div>
          <ToppingsSelector
            label="Toppings"
            options={TOPPING_SIZE_OPTIONS}
            selected={selectedToppingSize}
            onSelect={(value) =>
              setSelectedToppingSize((prev) => (prev === value ? "" : value))
            }
          />
        </div>

        {/* Ice -> Toppings type */}
        <div>
          <ToppingsSelector
            label="Toppings Type"
            options={TOPPING_TYPE_OPTIONS}
            selected={selectedToppingType}
            onSelect={(value) =>
              setSelectedToppingType((prev) => (prev === value ? "" : value))
            }
          />
        </div>
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
