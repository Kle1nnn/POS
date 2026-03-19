"use client";
import { useEffect, useRef } from "react";
import { CartItem } from "../context/CartContext";

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
      return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <b>${item.name}${sizePart}</b>
          ${extras ? `<br/><span style="font-size:9px;">${extras}</span>` : ""}
        </td>
        <td style="text-align:center;">${item.quantity} P</td>
        <td style="text-align:right;">${item.price.toFixed(0)}</td>
        <td style="text-align:right;">${(item.price * item.quantity).toFixed(0)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; font-weight:bold; }
  body {
    font-family: 'Courier New', Courier, monospace;
    width: 80mm;
    margin: 0 auto;
    padding: 4mm 4mm;
    font-size: 11px;
    color: #000;
  }
  @media print {
    body { width: 80mm; margin: 0; padding: 3mm; }
    @page { margin: 0; size: 80mm auto; }
  }
  .center { text-align: center; }
  .dotted { border-top: 1px dotted #000; margin: 5px 0; }
  .store-name { font-size: 16px; font-weight: 900; letter-spacing: 0.5px; margin: 3px 0 1px; }
  .store-sub  { font-size: 11px; margin: 1px 0; }
  .order-id   { font-size: 14px; font-weight: 900; letter-spacing: 1px; }
  .paid-stamp {
    text-align: center; margin: 8px 0 4px; padding: 6px 0;
    border: 3px solid #000; border-radius: 4px;
    font-size: 28px; font-weight: 900; letter-spacing: 6px;
  }
  table { width: 100%; border-collapse: collapse; }
  td, th { font-size: 11px; padding: 2px 2px; vertical-align: top; font-weight: bold; }
  .items-head th { border-bottom: 2px solid #000; border-top: 2px solid #000; font-size: 10px; }
  .grand-total td { font-size: 14px; font-weight: 900; padding: 3px 2px; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  .payment-box { border: 2px solid #000; padding: 5px 6px; margin-top: 6px; }
  .payment-title { text-align: center; margin-bottom: 3px; font-size: 13px; text-decoration: underline; }
  .payment-grid { display: flex; justify-content: space-between; }
  .meta-label { display: inline-block; width: 72px; }
</style>
</head>
<body>

  <div class="center">
    <div class="store-name">Tasty Bites</div>
    <div class="store-sub">Kamran Centre, Tharushah</div>
    <div class="store-sub">03213611550 | 03063096900</div>
  </div>

  <div class="dotted"></div>

  <table>
    <tr>
      <td><span class="meta-label">Date:</span> ${dateStr} ${timeStr}</td>
      <td style="text-align:right;" class="order-id">${orderId}</td>
    </tr>
    <tr><td><span class="meta-label">Type:</span> ${orderType ?? "Delivery"}</td></tr>
    <tr><td><span class="meta-label">Table:</span> ${orderType === "Dine In" && tableNumber ? `#${tableNumber}` : "—"}</td></tr>
    <tr><td><span class="meta-label">Customer:</span> ${customer?.name || "—"}</td></tr>
    <tr><td><span class="meta-label">Mobile:</span> ${customer?.phone || "N/A"}</td></tr>
  </table>

  ${notes ? `<div class="dotted"></div><div><span class="meta-label">Notes:</span> ${notes}</div>` : ""}

  <div class="dotted"></div>

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
    <tbody>${itemRows}</tbody>
  </table>

  <div class="dotted"></div>

  <table>
    <tr class="grand-total">
      <td>TOTAL:</td>
      <td style="text-align:right;">Rs ${totalPrice.toFixed(0)}</td>
    </tr>
  </table>

  ${isPaid ? `<div class="paid-stamp">✓ PAID</div>` : ""}

  <div class="payment-box">
    <div class="payment-title">Online Payment</div>
    <div class="payment-grid">
      <div>M. Saleh<br/>03013149288</div>
      <div style="text-align:right;">Atique Hyder<br/>JazzCash 03009801494</div>
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasTriggered = useRef(false);

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

  // As soon as the modal opens and the iframe loads, fire print immediately
  useEffect(() => {
    if (!isOpen) {
      hasTriggered.current = false;
    }
  }, [isOpen]);

  const handleIframeLoad = () => {
    if (!isOpen || hasTriggered.current) return;
    hasTriggered.current = true;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // Close our modal after a short delay so user sees nothing behind the print dialog
    setTimeout(() => onClose(), 500);
  };

  if (!isOpen) return null;

  // Render a hidden iframe only — no visible modal UI at all
  return (
    <iframe
      ref={iframeRef}
      srcDoc={receiptHTML}
      title="Receipt Print"
      onLoad={handleIframeLoad}
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        width: "80mm",
        height: "1px",
        border: "none",
        visibility: "hidden",
      }}
    />
  );
}
