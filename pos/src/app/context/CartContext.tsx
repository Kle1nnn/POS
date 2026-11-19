"use client";
import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Product } from "../components/Product";

export type CartItem = Product & {
  cartKey: string; // unique: "id__size__topping__sauce"
  selectedSize?: string;
  selectedTopping?: string;
  selectedSauce?: string;
  quantity: number;
  price: number;
};

export type CartStockResult = {
  ok: boolean;
  reason?: "out_of_stock" | "exceeds_stock";
  available?: number;
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
  addToCart: (
    item: Omit<CartItem, "quantity"> & {
      quantity?: number;
      maxStock?: number | null;
    },
  ) => CartStockResult;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;
  updateQuantity: (
    cartKey: string,
    newQuantity: number,
    maxStock?: number | null,
  ) => CartStockResult;
  updatePrice: (cartKey: string, newPrice: number) => void;
  loadOrder: (items: CartItem[]) => void;
  totalPrice: number;
  productSearchQuery: string;
  setProductSearchQuery: (value: string) => void;
  scanSubmitCount: number;
  submitProductSearchScan: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const cartItemsRef = useRef<CartItem[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [scanSubmitCount, setScanSubmitCount] = useState(0);

  const submitProductSearchScan = useCallback(() => {
    setScanSubmitCount((c) => c + 1);
  }, []);

  const updateCart = useCallback((next: CartItem[]) => {
    cartItemsRef.current = next;
    setCartItems(next);
  }, []);

  const addToCart = useCallback(
    (
      newItem: Omit<CartItem, "quantity"> & {
        quantity?: number;
        maxStock?: number | null;
      },
    ): CartStockResult => {
      const { maxStock, ...cleanItem } = newItem;
      const addQty = Math.max(1, Number(cleanItem.quantity) || 1);
      const cap =
        maxStock !== undefined ? maxStock : (cleanItem.stock ?? null);

      const current = cartItemsRef.current;

      if (cap !== null && cap !== undefined) {
        if (cap <= 0) {
          return { ok: false, reason: "out_of_stock", available: 0 };
        }
        const usedForProduct = current
          .filter((i) => i.id === cleanItem.id)
          .reduce((sum, i) => sum + i.quantity, 0);
        if (usedForProduct + addQty > cap) {
          return { ok: false, reason: "exceeds_stock", available: cap };
        }
      }

      const existing = current.find((i) => i.cartKey === cleanItem.cartKey);
      const next = existing
        ? current.map((i) =>
            i.cartKey === cleanItem.cartKey
              ? { ...i, ...cleanItem, quantity: i.quantity + addQty }
              : i,
          )
        : [...current, { ...cleanItem, quantity: addQty }];

      updateCart(next);
      return { ok: true };
    },
    [updateCart],
  );

  const removeFromCart = useCallback(
    (cartKey: string) => {
      updateCart(cartItemsRef.current.filter((i) => i.cartKey !== cartKey));
    },
    [updateCart],
  );

  const clearCart = useCallback(() => {
    updateCart([]);
  }, [updateCart]);

  const loadOrder = useCallback(
    (items: CartItem[]) => {
      updateCart(items.map((i) => ({ ...i, quantity: i.quantity || 1 })));
    },
    [updateCart],
  );

  const updateQuantity = useCallback(
    (
      cartKey: string,
      newQuantity: number,
      maxStock?: number | null,
    ): CartStockResult => {
      if (newQuantity < 1) {
        removeFromCart(cartKey);
        return { ok: true };
      }

      const current = cartItemsRef.current;
      const target = current.find((i) => i.cartKey === cartKey);
      if (!target) return { ok: false };

      if (newQuantity > target.quantity) {
        const cap =
          maxStock !== undefined ? maxStock : (target.stock ?? null);
        if (cap !== null && cap !== undefined) {
          if (cap <= 0) {
            return { ok: false, reason: "out_of_stock", available: 0 };
          }
          const otherQty = current
            .filter((i) => i.id === target.id && i.cartKey !== cartKey)
            .reduce((sum, i) => sum + i.quantity, 0);
          if (otherQty + newQuantity > cap) {
            return { ok: false, reason: "exceeds_stock", available: cap };
          }
        }
      }

      updateCart(
        current.map((i) =>
          i.cartKey === cartKey ? { ...i, quantity: newQuantity } : i,
        ),
      );
      return { ok: true };
    },
    [removeFromCart, updateCart],
  );

  const updatePrice = useCallback(
    (cartKey: string, newPrice: number) => {
      if (Number.isNaN(newPrice) || newPrice < 0) return;
      updateCart(
        cartItemsRef.current.map((i) =>
          i.cartKey === cartKey ? { ...i, price: newPrice } : i,
        ),
      );
    },
    [updateCart],
  );

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
        updatePrice,
        loadOrder,
        totalPrice,
        productSearchQuery,
        setProductSearchQuery,
        scanSubmitCount,
        submitProductSearchScan,
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
