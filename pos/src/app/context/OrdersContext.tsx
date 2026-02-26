"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { CartItem } from "./CartContext";

export type OrderStatus = "saved" | "checkedout";

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: string;
  status: OrderStatus;
  checkedOutAt?: string;
}

type OrdersContextType = {
  savedOrders: Order[];
  history: Order[];
  saveOrder: (items: CartItem[], total: number) => string;
  checkoutOrder: (orderId: string) => void;
  deleteOrder: (orderId: string) => void;
};

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);

  const saveOrder = (items: CartItem[], total: number): string => {
    const id = `ORD-${Date.now()}`;
    const newOrder: Order = {
      id,
      items,
      total,
      createdAt: new Date().toLocaleString(),
      status: "saved",
    };
    setOrders((prev) => [newOrder, ...prev]);
    return id;
  };

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
