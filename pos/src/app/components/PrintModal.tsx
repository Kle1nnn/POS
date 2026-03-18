"use client";
import { useEffect, useRef, useState } from "react";
import { CartItem } from "../context/CartContext";
import { useQZPrinter } from "./hooks/useQZPrinter";

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalPrice: number;
  notes: string;
  orderId: string;
  isPaid?: boolean;
  customer?: { name: string; phone: string };
  orderType?: string;
  tableNumber?: number | null;
}

function buildReceiptHTML(
  cartItems: CartItem[],
  totalPrice: number,
  notes: string,
  orderId: string,
  isPaid: boolean,
  customer?: { name: string; phone: string },
  orderType?: string,
  tableNumber?: number | null,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-PK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const itemRows = cartItems
    .map((item, idx) => {
      const extras = [item.selectedTopping, item.selectedSauce]
        .filter((v) => v && v !== "None" && v !== "N/A")
        .join(", ");
      const sizePart =
        item.selectedSize && item.selectedSize !== "N/A"
          ? ` (${item.selectedSize})`
          : "";
      const unitPrice = item.price;
      const subTotal = item.price * item.quantity;
      return `
        <tr>
          <td style="padding:3px 2px;font-size:11px;vertical-align:top;width:18px;">${idx + 1}</td>
          <td style="padding:3px 2px;font-size:11px;vertical-align:top;">
            ${item.name}${sizePart}
            ${extras ? `<br/><span style="font-size:9px;color:#555;">${extras}</span>` : ""}
          </td>
          <td style="text-align:center;padding:3px 2px;font-size:11px;vertical-align:top;white-space:nowrap;">${item.quantity} P</td>
          <td style="text-align:right;padding:3px 2px;font-size:11px;vertical-align:top;white-space:nowrap;">${unitPrice.toFixed(0)}</td>
          <td style="text-align:right;padding:3px 2px;font-size:11px;vertical-align:top;white-space:nowrap;">${subTotal.toFixed(0)}</td>
        </tr>`;
    })
    .join("");

  const shortOrderId = orderId.slice(-8).toUpperCase();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 76mm;
    margin: 0 auto;
    padding: 4mm 4mm;
    font-size: 11px;
    color: #000;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: bold; }
  .dotted { border-top: 1px dotted #000; margin: 5px 0; }
  .solid { border-top: 1px solid #000; margin: 5px 0; }
  .logo-box {
    width: 64px;
    height: 64px;
    border: 2px dashed #bbb;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 4px;
  }
  .logo-text { font-size: 9px; color: #aaa; letter-spacing: 1px; }
  .store-title { font-size: 15px; font-weight: bold; letter-spacing: 0.5px; margin: 3px 0 1px; }
  .store-sub { font-size: 11px; margin: 1px 0; }
  .store-phone { font-size: 11px; margin: 1px 0; }
  .gold { color: #b8860b; font-weight: bold; }
  .paid-stamp {
    text-align: center;
    margin: 8px 0 4px;
    padding: 6px 0;
    border: 3px solid #1a7a1a;
    border-radius: 4px;
    color: #1a7a1a;
    font-size: 28px;
    font-weight: bold;
    letter-spacing: 6px;
  }
  table { width: 100%; border-collapse: collapse; }
  .meta-table td { font-size: 11px; padding: 1px 0; vertical-align: top; }
  .meta-label { font-weight: bold; display: inline-block; width: 72px; }
  .meta-right { text-align: right; font-size: 11px; }
  .items-head th { font-size: 10px; font-weight: bold; padding: 2px 2px; border-bottom: 1px solid #000; border-top: 1px solid #000; }
  .totals-table td { font-size: 12px; padding: 2px 2px; }
  .grand-total td { font-size: 13px; font-weight: bold; padding: 3px 2px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
  .payment-box {
    border: 2px solid #000;
    padding: 5px 6px;
    margin-top: 6px;
    font-size: 11px;
    font-weight: bold;
  }
  .payment-box .title { font-weight: bold; text-align: center; margin-bottom: 3px; font-size: 13px; text-decoration: underline; }
  .payment-grid { display: flex; justify-content: space-between; }
  .payment-person { font-size: 11px; line-height: 1.5; font-weight: bold; }
</style>
</head>
<body>

  <!-- Header -->
  <div class="center">
    <div class="logo-box">
      <span class="logo-text">LOGO</span>
    </div>
    <div class="store-sub">Kamran Centre, Tharushah</div>
    <div class="store-phone">Mobile: <span class="gold">03213611550</span>, <span class="gold">03063096900</span></div>
  </div>

  <div class="dotted"></div>

  <!-- Order meta -->
  <table class="meta-table">
    <tr>
      <td><span class="meta-label">Date</span> <span>${dateStr} ${timeStr}</span></td>
      <td class="meta-right" style="vertical-align:top;padding-left:4px;white-space:nowrap;">
        <span style="font-size:10px;">#${shortOrderId}</span>
      </td>
    </tr>
    <tr>
      <td><span class="meta-label">Type:</span> <span style="font-weight:bold;">${orderType ?? "Delivery"}</span></td>
    </tr>
    <tr>
      <td><span class="meta-label">Table:</span> <span>${orderType === "Dine In" && tableNumber ? `#${tableNumber}` : "—"}</span></td>
    </tr>
    <tr>
      <td><span class="meta-label">Customer:</span> <span>${customer?.name || "—"}</span></td>
    </tr>
    <tr>
      <td><span class="meta-label">Mobile:</span> <span>${customer?.phone || "N-A"}</span></td>
    </tr>
  </table>

  ${
    notes
      ? `
  <div class="dotted"></div>
  <div style="font-size:11px;"><span class="bold">Notes:</span> ${notes}</div>
  `
      : ""
  }

  <div class="dotted"></div>

  <!-- Items table -->
  <table>
    <thead class="items-head">
      <tr>
        <th style="text-align:left;width:16px;">#</th>
        <th style="text-align:left;">Product</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Price</th>
        <th style="text-align:right;">Sub</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="dotted"></div>

  <!-- Totals -->
  <table class="totals-table">
    <tr>
      <td colspan="3" style="text-align:right;"><span class="bold">Subtotal:</span></td>
      <td style="text-align:right;font-weight:bold;white-space:nowrap;">Rs ${totalPrice.toFixed(0)}</td>
    </tr>
  </table>
  <table>
    <tr class="grand-total">
      <td><span class="bold">Total:</span></td>
      <td style="text-align:right;white-space:nowrap;">Rs ${totalPrice.toFixed(0)}</td>
    </tr>
  </table>

  ${isPaid ? `<div class="paid-stamp">✓ PAID</div>` : ""}

  <!-- Online Payment box -->
  <div class="payment-box">
    <div class="title">Online Payment</div>
    <div class="payment-grid">
      <div class="payment-person">
        <div class="bold">M. Saleh</div>
        <div>03013149288</div>
      </div>
      <div class="payment-person" style="text-align:right;">
        <div class="bold">Atique Hyder</div>
        <div>JazzCash 03009801494</div>
      </div>
    </div>
  </div>

</body>
</html>`;
}

export default function PrintModal({
  isOpen,
  onClose,
  cartItems,
  totalPrice,
  notes,
  orderId,
  isPaid = false,
  customer,
  orderType,
  tableNumber,
}: PrintModalProps) {
  const {
    status,
    printers,
    selectedPrinter,
    setSelectedPrinter,
    errorMsg,
    connect,
    printHTML,
  } = useQZPrinter();
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const [printSuccess, setPrintSuccess] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  const receiptHTML = buildReceiptHTML(
    cartItems,
    totalPrice,
    notes,
    orderId,
    isPaid,
    customer,
    orderType,
    tableNumber,
  );

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Reset state when modal reopens
  useEffect(() => {
    if (isOpen) {
      setPrintError("");
      setPrintSuccess(false);
    }
  }, [isOpen]);

  const handlePrint = async () => {
    setPrinting(true);
    setPrintError("");
    try {
      await printHTML(receiptHTML);
      setPrintSuccess(true);
      setTimeout(() => onClose(), 1200);
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : "Print failed.");
    } finally {
      setPrinting(false);
    }
  };

  if (!isOpen) return null;

  const statusColor: Record<string, string> = {
    loading: "text-gray-400",
    ready: "text-yellow-600",
    connected: "text-green-600",
    error: "text-red-500",
  };

  const statusLabel: Record<string, string> = {
    loading: "Loading QZ Tray…",
    ready: "Connecting…",
    connected: `Connected${printers.length > 0 ? ` · ${printers.length} printer(s)` : ""}`,
    error: errorMsg || "QZ Tray error",
  };

  return (
    /* ── Backdrop ── */
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
    >
      {/* ── Modal card ── */}
      <div
        className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw] max-h-[90vh] flex flex-col overflow-hidden"
        style={{ animation: "modalIn 0.18s cubic-bezier(.4,0,.2,1)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧾</span>
            <span className="font-semibold text-gray-900 text-sm">
              Receipt Preview
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* QZ Status bar */}
        <div className="flex items-center justify-between px-5 py-2 bg-gray-50 border-b border-gray-100 text-xs">
          <span className={`font-medium ${statusColor[status]}`}>
            {statusLabel[status]}
          </span>
          {status === "error" && (
            <button
              onClick={connect}
              className="text-xs text-amber-900 font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          )}
          {status === "connected" && printers.length > 1 && (
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="text-xs border border-gray-200 rounded-md px-2 py-0.5 bg-white"
            >
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Receipt preview */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div
            className="bg-white rounded-xl border border-dashed border-gray-300 mx-auto shadow-sm overflow-hidden"
            style={{ width: "280px", minHeight: "200px" }}
          >
            <iframe
              srcDoc={receiptHTML}
              title="Receipt Preview"
              style={{ width: "100%", border: "none", minHeight: "340px" }}
              scrolling="no"
              onLoad={(e) => {
                // Auto-resize iframe to content height
                const iframe = e.currentTarget;
                try {
                  const h = iframe.contentDocument?.body?.scrollHeight;
                  if (h) iframe.style.height = h + 12 + "px";
                } catch {
                  // cross-origin fallback
                }
              }}
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 bg-white space-y-2">
          {printError && (
            <p className="text-xs text-red-500 text-center">{printError}</p>
          )}
          {printSuccess && (
            <p className="text-xs text-green-600 text-center font-medium">
              ✅ Sent to printer!
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={status !== "connected" || printing || printSuccess}
              className="flex-1 py-2 rounded-lg bg-amber-900 hover:bg-amber-800 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {printing ? (
                <>
                  <span className="animate-spin">⏳</span> Printing…
                </>
              ) : (
                <>🖨️ Print Receipt</>
              )}
            </button>
          </div>

          {status === "error" && (
            <p className="text-[10px] text-gray-400 text-center">
              Make sure{" "}
              <a
                href="https://qz.io/download/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-amber-900"
              >
                QZ Tray
              </a>{" "}
              is installed and running on this computer.
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
