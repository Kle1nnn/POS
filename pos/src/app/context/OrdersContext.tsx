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
  // customer + order type fields
  customerName?: string;
  customerPhone?: string;
  orderType?: string;
  tableNumber?: number | null;
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
  saveOrder: (
    items: CartItem[],
    total: number,
    notes?: string,
    customerName?: string,
    customerPhone?: string,
    orderType?: string,
    tableNumber?: number | null,
  ) => string;
  checkoutOrder: (orderId: string) => void;
  deleteOrder: (orderId: string) => void;
  updateOrder: (
    orderId: string,
    items: CartItem[],
    total: number,
    notes?: string,
  ) => void;
  editingOrderId: string | null;
  setEditingOrderId: (id: string | null) => void;
};

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

// Sequential order counter — seeded from DB on first hydration to avoid collisions after refresh
let _tbtCounter = 0;
let _tbtSeeded = false;

function seedCounter(orders: { id: string }[]) {
  if (_tbtSeeded) return;
  _tbtSeeded = true;
  // Find highest existing TBT-N number so next ID continues from there
  let max = 0;
  for (const o of orders) {
    const match = o.id.match(/^TBT-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  if (max > _tbtCounter) _tbtCounter = max;
}

function nextTBTId(): string {
  _tbtCounter += 1;
  return `TBT-${_tbtCounter}`;
}

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

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
            customerName?: string;
            customerPhone?: string;
            orderType?: string;
            tableNumber?: number | null;
            createdAt: string;
            checkedOutAt?: string;
            items: CartItem[];
          }[];
        };
        const mapped = data.orders.map((o) => ({
          id: o.orderCode,
          items: o.items,
          total: o.total,
          notes: o.notes,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          orderType: o.orderType,
          tableNumber: o.tableNumber,
          createdAt: o.createdAt,
          status: o.status,
          checkedOutAt: o.checkedOutAt,
        }));
        seedCounter(mapped);
        setOrders((prev) => (prev.length > 0 ? prev : mapped));
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
    customerName?: string,
    customerPhone?: string,
    orderType?: string,
    tableNumber?: number | null,
  ): string => {
    const id = nextTBTId();
    const newOrder: Order = {
      id,
      items,
      total,
      notes,
      customerName,
      customerPhone,
      orderType,
      tableNumber,
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

  const updateOrder = (
    orderId: string,
    items: CartItem[],
    total: number,
    notes?: string,
  ) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, items, total, notes } : o)),
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
      value={{
        savedOrders,
        history,
        saveOrder,
        checkoutOrder,
        deleteOrder,
        updateOrder,
        editingOrderId,
        setEditingOrderId,
      }}
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
