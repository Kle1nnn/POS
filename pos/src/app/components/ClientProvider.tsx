"use client";

import React from "react";
import { CartProvider } from "../context/CartContext";
import { CategoryProvider } from "../context/CategoryContext";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CategoryProvider>
      <CartProvider>{children}</CartProvider>
    </CategoryProvider>
  );
}
