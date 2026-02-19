"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Product } from "../components/Product";

type CartContextType = {
  cartItems: (Product & {
    selectedSize?: string;
    selectedTopping?: string;
    selectedSauce?: string;
    quantity?: number;
    price?: number;
  })[];
  addToCart: (
    item: Product & {
      selectedSize?: string;
      selectedTopping?: string;
      selectedSauce?: string;
      quantity?: number;
      price?: number;
    },
  ) => void;
  removeFromCart: (id: string | number) => void;
  clearCart: () => void;
  updateQuantity: (id: string | number, newQuantity: number) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<
    (Product & {
      selectedSize?: string;
      selectedTopping?: string;
      selectedSauce?: string;
      quantity?: number;
      price?: number;
    })[]
  >([]);

  const addToCart = (
    newItem: Product & {
      selectedSize?: string;
      selectedTopping?: string;
      selectedSauce?: string;
      quantity?: number;
      price?: number;
    },
  ) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === newItem.id);
      if (existing) {
        return prev.map((i) =>
          i.id === newItem.id
            ? { ...i, quantity: (i.quantity || 1) + (newItem.quantity || 1) }
            : i,
        );
      }
      return [...prev, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  };

  const removeFromCart = (id: string | number) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  const updateQuantity = (id: string | number, newQuantity: number) => {
    if (newQuantity < 1) return;
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity: newQuantity } : item,
      ),
    );
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
