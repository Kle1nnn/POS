"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Product } from "../components/Product";
export interface CartItem extends Product {
  selectedSize: string;
  selectedTopping: string;
  selectedSauce: string;
  quantity?: number;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (newItem: CartItem) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find(
        (item) =>
          item.id === newItem.id &&
          item.selectedSize === newItem.selectedSize &&
          item.selectedTopping === newItem.selectedTopping &&
          item.selectedSauce === newItem.selectedSauce,
      );

      if (existing) {
        return prevItems.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item,
        );
      }

      return [...prevItems, { ...newItem, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setCartItems([]);

  return (
    <CartContext.Provider
      value={{ cartItems, addToCart, removeFromCart, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
