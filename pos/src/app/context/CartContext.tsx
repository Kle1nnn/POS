"use client";
import { createContext, useContext, useState, ReactNode } from "react";
import { Product } from "../components/Product";

export type CartItem = Product & {
  cartKey: string; // unique: "id__size__topping__sauce"
  selectedSize?: string;
  selectedTopping?: string;
  selectedSauce?: string;
  quantity: number;
  price: number;
};

// Call this in each card before addToCart to generate a unique key
export function makeCartKey(
  id: string,
  size?: string,
  topping?: string,
  sauce?: string,
): string {
  return `${id}__${size ?? ""}__${topping ?? ""}__${sauce ?? ""}`;
}

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, "quantity"> & { quantity?: number }) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  updateQuantity: (cartKey: string, newQuantity: number) => void;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const addToCart = (
    newItem: Omit<CartItem, "quantity"> & { quantity?: number },
  ) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.cartKey === newItem.cartKey);
      if (existing) {
        return prev.map((i) =>
          i.cartKey === newItem.cartKey
            ? { ...i, quantity: i.quantity + (newItem.quantity || 1) }
            : i,
        );
      }
      return [...prev, { ...newItem, quantity: newItem.quantity || 1 }];
    });
  };

  const removeFromCart = (cartKey: string) => {
    setCartItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  };

  const clearCart = () => setCartItems([]);

  const updateQuantity = (cartKey: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(cartKey);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) =>
        i.cartKey === cartKey ? { ...i, quantity: newQuantity } : i,
      ),
    );
  };

  const totalPrice = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        updateQuantity,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
