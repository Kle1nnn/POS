"use client";

import React from "react";
import { CartProvider } from "../context/CartContext";
import { OrdersProvider } from "../context/OrdersContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <OrdersProvider>{children}</OrdersProvider>
    </CartProvider>
  );
}
