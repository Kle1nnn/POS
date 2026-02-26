"use client";
import React, { useState } from "react";
import { Product } from "../Product";
import { useCart } from "../../context/CartContext";
import { toppingsPrice } from "../priceRules";

interface PizzaCardProps {
  product: Product;
}

export default function PizzaCard({ product }: PizzaCardProps) {
  const { addToCart } = useCart();
  const [selectedSize, setSelectedSize] = useState<string>("S");
  const [selectedTopping, setSelectedTopping] = useState<string>("");
  const [selectedSauce, setSelectedSauce] = useState<string>("");

  const sizePrice = product.sizePrices?.[selectedSize] ?? product.basePrice;
  const toppingPrice = selectedTopping
    ? (toppingsPrice[selectedTopping] ?? 0)
    : 0;
  const finalPrice = sizePrice + toppingPrice;

  const handleAddToBilling = () => {
    addToCart({
      ...product,
      selectedSize,
      selectedTopping: selectedTopping || "None",
      selectedSauce: selectedSauce || "None",
      price: finalPrice,
    });
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Product Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-amber-900 to-amber-700" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-gray-900 mb-0.5">
            {product.name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mb-1">
            {product.description}
          </p>
          <p className="text-lg font-bold text-gray-900">
            Rs. {finalPrice.toFixed(0)}
          </p>
        </div>
      </div>

      {/* Size */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-700 mb-2 block">
          Size
        </label>
        <div className="flex gap-2">
          {["S", "M", "L"].map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedSize === size
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Toppings */}
      <div className="mb-3">
        <label className="text-xs font-semibold text-gray-700 mb-2 block">
          Toppings
        </label>
        <div className="flex gap-2">
          {["S", "M", "L"].map((topping) => (
            <button
              key={topping}
              onClick={() => setSelectedTopping(topping)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedTopping === topping
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {topping}
            </button>
          ))}
        </div>
      </div>

      {/* Sauce */}
      <div className="mb-4">
        <label className="text-xs font-semibold text-gray-700 mb-2 block">
          Sauce
        </label>
        <div className="flex flex-col gap-1.5">
          {["", "Mayo", "Cheese"].map((sauce) => (
            <button
              key={sauce}
              onClick={() => {
                setSelectedSauce(sauce);
                if (sauce === "") setSelectedTopping(""); // None clears toppings too
              }}
              className={`py-1.5 rounded-lg text-xs font-medium transition-all ${
                selectedSauce === sauce
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {sauce || "None"}
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
