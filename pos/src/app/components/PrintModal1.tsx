"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { CartItem } from "../context/CartContext";
import {
  printHtml,
  buildReceiptHTML,
  fetchReceiptSettings,
} from "../lib/receipt";
import {
  DEFAULT_RECEIPT_SETTINGS,
  type ReceiptSettings,
} from "../../lib/receipt-settings-shared";

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
  customSettings?: ReceiptSettings;
  isPreview?: boolean;
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
  customSettings,
  isPreview = false,
}: PrintModalProps) {
  const [settings, setSettings] = useState<ReceiptSettings>(
    customSettings ?? DEFAULT_RECEIPT_SETTINGS,
  );
  const [printing, setPrinting] = useState(false);
  const [printStatus, setPrintStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPrintStatus(null);
      setPrinting(false);
      return;
    }

    if (customSettings) {
      setSettings(customSettings);
      return;
    }

    let isSubscribed = true;

    // Load receipt settings for preview and printing
    void fetchReceiptSettings().then((s) => {
      if (isSubscribed) setSettings(s);
    });

    return () => {
      isSubscribed = false;
    };
  }, [isOpen, customSettings]);

  const customerHtml = useMemo(() => {
    return buildReceiptHTML(
      cartItems,
      totalPrice,
      notes,
      instructions,
      orderId,
      isPaid,
      customer,
      orderType,
      tableNumber,
      "customer",
      settings,
      placedAt,
    );
  }, [
    cartItems,
    totalPrice,
    notes,
    instructions,
    orderId,
    isPaid,
    customer,
    orderType,
    tableNumber,
    settings,
    placedAt,
  ]);

  const handlePrintReceiptOnly = useCallback(async () => {
    try {
      setPrinting(true);
      setPrintStatus("Sending to printer…");

      // 1. Direct preview iframe print if available
      const previewIframe = document.querySelector(
        'iframe[title="Receipt Preview"]',
      ) as HTMLIFrameElement | null;
      if (previewIframe && previewIframe.contentWindow) {
        try {
          previewIframe.contentWindow.focus();
          previewIframe.contentWindow.print();
          setPrintStatus("Print dialog opened! (Press Enter to print again)");
          return;
        } catch {
          // fallback to printHtml
        }
      }

      // 2. Dedicated printHtml pipeline
      await printHtml(customerHtml);
      setPrintStatus("Print dialog opened! (Press Enter to print again)");
    } catch (e) {
      console.error(e);
      setPrintStatus("Print error. Please check printer connection.");
    } finally {
      setPrinting(false);
    }
  }, [customerHtml]);

  // Auto-trigger print prompt when modal opens (skipped in preview mode)
  useEffect(() => {
    if (!isOpen || isPreview) return;
    const timer = setTimeout(() => {
      void handlePrintReceiptOnly();
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, isPreview, handlePrintReceiptOnly]);

  // Keyboard shortcut: 'Enter' confirms checkout action and prints receipt
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p")) {
        e.preventDefault();
        void handlePrintReceiptOnly();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handlePrintReceiptOnly, onClose]);

  // Unconditional hook placement: early return ONLY occurs right before JSX rendering
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full flex flex-col overflow-hidden max-h-[92vh] border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{isPreview ? "👁️" : "🖨️"}</span>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-tight flex items-center gap-2">
                <span>Receipt {orderId}</span>
                {isPreview ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                    PREVIEW
                  </span>
                ) : isPaid ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700">
                    PAID
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                    SAVED
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {orderType || "Delivery"} • Rs. {totalPrice}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Status banner */}
        {printStatus && (
          <div className="bg-blue-50 px-4 py-2 text-xs text-blue-800 border-b border-blue-100 flex items-center justify-between">
            <span>{printStatus}</span>
            {printing && <span className="animate-spin text-sm">⏳</span>}
          </div>
        )}

        {/* Receipt paper preview */}
        <div className="p-4 bg-gray-100 flex-1 overflow-y-auto flex justify-center">
          <div className="bg-white border border-gray-300 shadow-sm rounded p-1 w-[80mm] max-w-full min-h-[300px]">
            <iframe
              title="Receipt Preview"
              srcDoc={customerHtml}
              className="w-full h-[400px] border-none bg-white pointer-events-none"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
          >
            Done / Close
          </button>

          <button
            autoFocus
            onClick={handlePrintReceiptOnly}
            disabled={printing}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            title="Print bill receipt only (Enter)"
          >
            <span>🖨️</span>
            <span>Print Receipt <kbd className="text-[10px] bg-blue-800/60 px-1.5 py-0.5 rounded font-mono">Enter</kbd></span>
          </button>
        </div>
      </div>
    </div>
  );
}
