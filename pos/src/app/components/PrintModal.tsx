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
          <span class="item-name">${item.name}${sizePart}</span>
          ${extras ? `<div class="item-extras">${extras}</div>` : ""}
        </td>
        <td class="num">${item.quantity}</td>
        <td class="num">${item.price.toFixed(0)}</td>
        <td class="num">${(item.price * item.quantity).toFixed(0)}</td>
      </tr>`;
    })
    .join("");

  const dineIn = orderType === "Dine In";
  const tableRow = dineIn
    ? `<tr><td colspan="2"><span class="meta-label">Table</span> ${tableNumber != null ? `#${tableNumber}` : "—"}</td></tr>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    width: 80mm;
    max-width: 80mm;
    margin: 0 auto;
    padding: 6mm 5mm 8mm;
    font-size: 15px;
    line-height: 1.35;
    color: #111;
    font-weight: 600;
  }
  @media print {
    body { width: 80mm; margin: 0; padding: 5mm 4mm; }
    @page { margin: 0; size: 80mm auto; }
  }
  .center { text-align: center; }
  .section { margin-top: 18px; }
  .section:first-of-type { margin-top: 0; }
  .store-name { font-size: 22px; font-weight: 800; letter-spacing: 0.02em; margin: 6px 0 4px; }
  .store-sub  { font-size: 13px; font-weight: 600; color: #333; margin: 2px 0; }
  .order-id   { font-size: 17px; font-weight: 800; letter-spacing: 0.04em; }
  .paid-stamp {
    text-align: center; margin: 14px 0 8px; padding: 10px 8px;
    border: 3px solid #000; border-radius: 6px;
    font-size: 32px; font-weight: 800; letter-spacing: 0.15em;
  }
  table.meta { width: 100%; border-collapse: collapse; font-size: 14px; }
  table.meta td { padding: 5px 0; vertical-align: top; }
  .meta-label { display: inline-block; min-width: 76px; font-weight: 700; color: #222; }
  table.items { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px; }
  table.items th {
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #333;
    padding: 8px 4px 6px 0;
    border-bottom: 2px solid #111;
  }
  table.items th.num, table.items td.num { text-align: right; }
  table.items th:nth-child(3), table.items th:nth-child(4), table.items th:nth-child(5) { text-align: right; }
  table.items td { padding: 8px 4px 8px 0; vertical-align: top; border-bottom: 1px solid #e8e8e8; }
  table.items td.num { font-variant-numeric: tabular-nums; }
  .item-name { font-size: 15px; font-weight: 700; display: block; }
  .item-extras { font-size: 12px; font-weight: 600; color: #555; margin-top: 3px; }
  .notes-block { font-size: 14px; margin-top: 14px; padding: 10px 0 0; border-top: 1px solid #ddd; }
  .grand-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 3px solid #111;
    font-size: 20px;
    font-weight: 800;
  }
  .payment-box {
    margin-top: 18px;
    padding: 12px 10px;
    background: #f6f6f6;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    line-height: 1.45;
  }
  .payment-title { text-align: center; margin-bottom: 8px; font-size: 14px; font-weight: 800; }
  .payment-grid { display: flex; justify-content: space-between; gap: 8px; }
</style>
</head>
<body>

  <div class="center section">
    <img src="/logo.png" alt="" style="width:112px; height:112px; object-fit:contain; margin-bottom:4px;"/>
    <div class="store-name">Tasty Bites</div>
    <div class="store-sub">Kamran Centre, Tharushah</div>
    <div class="store-sub">03213611550 · 03063096900</div>
  </div>

  <table class="meta section">
    <tr>
      <td><span class="meta-label">Date</span> ${dateStr} · ${timeStr}</td>
      <td style="text-align:right;" class="order-id">${orderId}</td>
    </tr>
    <tr><td colspan="2"><span class="meta-label">Type</span> ${orderType ?? "Delivery"}</td></tr>
    ${tableRow}
    <tr><td colspan="2"><span class="meta-label">Customer</span> ${customer?.name || "—"}</td></tr>
    <tr><td colspan="2"><span class="meta-label">Mobile</span> ${customer?.phone || "—"}</td></tr>
  </table>

  ${notes ? `<div class="notes-block"><span class="meta-label">Notes</span> ${notes}</div>` : ""}

  <table class="items section">
    <thead>
      <tr>
        <th style="width:22px;">#</th>
        <th>Item</th>
        <th class="num" style="width:28px;">Qty</th>
        <th class="num" style="width:40px;">Rs</th>
        <th class="num" style="width:44px;">Sub</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="grand-total">
    <span>TOTAL</span>
    <span>Rs ${totalPrice.toFixed(0)}</span>
  </div>

  ${isPaid ? `<div class="paid-stamp">✓ PAID</div>` : ""}

  <div class="payment-box">
    <div class="payment-title">Online payment</div>
    <div class="payment-grid">
      <div>M. Saleh — 03013149288</div>
      <div style="text-align:right;">Atique Hyder — JazzCash 03009801494</div>
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
