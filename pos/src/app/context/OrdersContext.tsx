"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { CartItem } from "./CartContext"; // both files live in src/context/

export type OrderStatus = "saved" | "checkedout";

export interface Order {
  id: string;
  items: CartItem[]; // full snapshot of cart at save time, includes cartKey
  total: number;
  notes?: string;
  createdAt: string;
  status: OrderStatus;
  checkedOutAt?: string; // only set when status flips to "checkedout"
}

type OrdersContextType = {
  savedOrders: Order[];
  history: Order[];
  saveOrder: (items: CartItem[], total: number, notes?: string) => string;
  checkoutOrder: (orderId: string) => void;
  deleteOrder: (orderId: string) => void;
};

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  // Hydrate from database on first mount
  useEffect(() => {
    const loadFromDb = async () => {
      try {
        const res = await fetch("/api/orders/list");
        if (!res.ok) return;
        const data = (await res.json()) as {
          orders: {
            orderCode: string;
            status: OrderStatus;
            total: number;
            notes?: string;
            createdAt: string;
            checkedOutAt?: string;
            items: CartItem[];
          }[];
        };
        setOrders((prev) =>
          prev.length > 0
            ? prev
            : data.orders.map((o) => ({
                id: o.orderCode,
                items: o.items,
                total: o.total,
                notes: o.notes,
                createdAt: o.createdAt,
                status: o.status,
                checkedOutAt: o.checkedOutAt,
              })),
        );
      } catch (e) {
        console.error("Failed to load orders from database", e);
      }
    };
    loadFromDb();
  }, []);

  // Saves order, returns the new order id so caller can immediately checkout if needed
  const saveOrder = (
    items: CartItem[],
    total: number,
    notes?: string,
  ): string => {
    const id = `ORD-${Date.now()}`;
    const newOrder: Order = {
      id,
      items,
      total,
      notes,
      createdAt: new Date().toLocaleString(),
      status: "saved",
    };
    setOrders((prev) => [newOrder, ...prev]);
    return id;
  };

  // Flips status to checkedout — moves it from savedOrders to history automatically
  const checkoutOrder = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "checkedout",
              checkedOutAt: new Date().toLocaleString(),
            }
          : o,
      ),
    );
  };

  const deleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // Derived views — no separate state, just filtered from same array
  const savedOrders = orders.filter((o) => o.status === "saved");
  const history = orders.filter((o) => o.status === "checkedout");

  return (
    <OrdersContext.Provider
      value={{ savedOrders, history, saveOrder, checkoutOrder, deleteOrder }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) throw new Error("useOrders must be used within OrdersProvider");
  return context;
}
