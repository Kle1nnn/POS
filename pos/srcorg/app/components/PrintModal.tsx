"use client";
import { useEffect, useRef } from "react";
import { CartItem } from "../context/CartContext";
import { hasBarBqItems, printOrderReceipts } from "../lib/receipt";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalPrice: number;
  notes: string;
  instructions?: string;
  orderId: string;
  isPaid?: boolean;
  customer?: { name: string; phone: string };
  orderType?: string;
  tableNumber?: number | null;
  /** Original order placed time — used on the receipt instead of print time */
  placedAt?: string | null;
}

export default function PrintModal({
  isOpen,
  onClose,
  cartItems,
  totalPrice,
  notes,
  instructions = "",
  orderId,
  isPaid = false,
  customer,
  orderType,
  tableNumber,
  placedAt = null,
}: PrintModalProps) {
  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      hasTriggered.current = false;
      return;
    }
    if (hasTriggered.current) return;
    hasTriggered.current = true;

    const run = async () => {
      try {
        await printOrderReceipts(
          cartItems,
          totalPrice,
          notes,
          instructions,
          orderId,
          isPaid,
          customer,
          orderType,
          tableNumber,
          placedAt,
        );
      } catch (e) {
        console.error("Print failed", e);
      } finally {
        onClose();
      }
    };

    void run();
  }, [
    isOpen,
    cartItems,
    totalPrice,
    notes,
    instructions,
    orderId,
    isPaid,
    customer,
    orderType,
    tableNumber,
    placedAt,
    onClose,
  ]);

  if (!isOpen) return null;

  const dualHint = hasBarBqItems(cartItems);

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      {dualHint ? "Printing customer + BBQ kitchen receipts…" : "Printing…"}
    </div>
  );
}
