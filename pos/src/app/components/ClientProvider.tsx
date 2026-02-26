"use client";

import React from "react";
import { CartProvider } from "../context/CartContext";
import { CategoryProvider } from "../context/CategoryContext";
import { OrdersProvider } from "../context/OrdersContext";
export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryProvider>
      <CartProvider>
        <OrdersProvider>{children}</OrdersProvider>
      </CartProvider>
    </CategoryProvider>
  );
}
