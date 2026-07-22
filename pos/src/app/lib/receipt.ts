import { CartItem } from "../context/CartContext";

export type ReceiptVariant = "customer" | "bbq-kitchen";

export function isBarBqItem(item: { category?: string | null }): boolean {
  const c = (item.category ?? "").trim().toLowerCase().replace(/\s+/g, "");
  return c === "barbq" || c === "bbq";
}

export function filterBarBqItems(items: CartItem[]): CartItem[] {
  return items.filter(isBarBqItem);
}

export function hasBarBqItems(items: CartItem[]): boolean {
  return items.some(isBarBqItem);
}

export function barBqSubtotal(items: CartItem[]): number {
  return filterBarBqItems(items).reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
}

export function buildReceiptHTML(
  cartItems: CartItem[],
  totalPrice: number,
  notes: string,
  instructions: string,
  orderId: string,
  isPaid: boolean,
  customer?: { name: string; phone: string },
  orderType?: string,
  tableNumber?: number | null,
  variant: ReceiptVariant = "customer",
): string {
  const isKitchen = variant === "bbq-kitchen";
  const displayItems = isKitchen ? filterBarBqItems(cartItems) : cartItems;
  const displayTotal = isKitchen ? barBqSubtotal(cartItems) : totalPrice;

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

  const itemRows = displayItems
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
        ${isKitchen ? "" : `<td class="num">${item.price.toFixed(0)}</td><td class="num">${(item.price * item.quantity).toFixed(0)}</td>`}
      </tr>`;
    })
    .join("");

  const dineIn = orderType === "Dine In";
  const tableRow = dineIn
    ? `<tr><td colspan="2"><span class="meta-label">Table</span> ${tableNumber != null ? `#${tableNumber}` : "—"}</td></tr>`
    : "";

  const kitchenBanner = isKitchen
    ? `
    <div class="kitchen-banner">BBQ KITCHEN</div>
    <div class="kitchen-sub">Kitchen copy — prepare BarBQ items only</div>
    <hr style="border: none; border-top: 1.5px solid #000; margin: 7px 0 4px;" />`
    : `
    <img src="logo.png" alt="" style="width:150px; height:150px; object-fit:contain; margin-bottom:4px;"/>
    <div class="store-name">Tasty Bites Pizza & Fast Food</div>
    <div class="store-sub">Kamran Centre, Tharushah</div>
    <div class="store-sub">03213611550 · 03063096900</div>
    ${isPaid ? `<hr style="border: none; border-top: 1px solid #000; margin: 7px 0 4px;" /><div class="paid-stamp">✓ PAID</div>` : ""}
    <hr style="border: none; border-top: 1.5px solid #000; margin: 7px 0 4px;" />`;

  const itemHeader = isKitchen
    ? `
      <tr>
        <th style="width:22px;">#</th>
        <th>Item</th>
        <th class="num" style="width:36px;">Qty</th>
      </tr>`
    : `
      <tr>
        <th style="width:22px;">#</th>
        <th>Item</th>
        <th class="num" style="width:28px;">Qty</th>
        <th class="num" style="width:40px;">Rs</th>
        <th class="num" style="width:44px;">Sub</th>
      </tr>`;

  const paymentBlock = isKitchen
    ? ""
    : `
  <div class="payment-box">
    <div class="payment-title"><h3>Online payment<h/3></div>
    <center><img src="Jz.jpg" alt="" style="width:100px; height:100px; object-fit:contain; margin-bottom:4px;"/>
    <div class="payment-grid">
      <div><h3>JazzCash 03213611550 M.Saleh<h/3></div>
    </div>
  </div>`;

  const totalLabel = isKitchen ? "BBQ ITEMS" : "TOTAL";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Inter', 'Segoe UI', Tahoma, Arial, sans-serif;
    width: 80mm;
    max-width: 80mm;
    margin: 0 auto;
    padding: 6mm 5mm 8mm;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0.03em;
    line-height: 1.35;
    color: #000;
    -webkit-font-smoothing: antialiased;
  }
  @media print {
    body { width: 80mm; margin: 0; padding: 5mm 4mm; }
    @page { margin: 0; size: 80mm auto; }
  }
  .center { text-align: center; }
  .section { margin-top: 18px; }
  .section:first-of-type { margin-top: 0; }

  .kitchen-banner {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin: 4px 0 2px;
    text-transform: uppercase;
  }
  .kitchen-sub {
    font-size: 12px;
    font-weight: 500;
    margin-bottom: 4px;
    color: #333;
  }

  .store-name {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin: 6px 0 4px;
    color: #000;
  }
  .store-sub {
    font-size: 15px;
    font-weight: 400;
    margin: 2px 0;
    letter-spacing: 0.05em;
  }

  .order-id {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.03em;
    color: #000;
  }
  .paid-stamp {
    text-align: center; margin: 10px 0 6px;
    font-size: 18px; font-weight: 600; letter-spacing: 0.12em;
    color: #000; text-transform: uppercase;
  }

  table.meta { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.meta td { padding: 5px 0; vertical-align: top; color: #000; font-weight: 400; letter-spacing: 0.03em; }
  .meta-label {
    display: inline-block;
    min-width: 76px;
    font-weight: 600;
    color: #000;
  }

  table.items { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  table.items th {
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #000;
    padding: 8px 4px 6px 0;
    border-bottom: 1px solid #000;
  }
  table.items th.num, table.items td.num { text-align: right; }
  table.items th:nth-child(3),
  table.items th:nth-child(4),
  table.items th:nth-child(5) { text-align: right; }
  table.items td {
    padding: 8px 4px 8px 0;
    vertical-align: top;
    border-bottom: 1px solid #ccc;
    color: #000;
    font-weight: 400;
    letter-spacing: 0.03em;
  }
  table.items td.num {
    font-variant-numeric: tabular-nums;
    font-weight: 500;
  }
  .item-name  { font-size: 13px; font-weight: 500; display: block; color: #000; letter-spacing: 0.03em; }
  .item-extras { font-size: 11px; font-weight: 400; color: #333; margin-top: 3px; letter-spacing: 0.03em; }

  .notes-block {
    font-size: 13px; margin-top: 14px;
    padding: 10px 0 0; border-top: 1px solid #bbb;
    color: #000; font-weight: 400; letter-spacing: 0.03em;
  }
  .grand-total {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #000;
    font-size: 16px;
    font-weight: 500;
    color: #000;
  }
  .payment-box {
    margin-top: 18px;
    padding: 12px 10px;
    background: #f0f0f0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 400;
    letter-spacing: 0.03em;
    line-height: 1.45;
    color: #000;
  }
  .payment-title {
    text-align: center;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #000;
  }
  .payment-grid { display: flex; justify-content: space-between; gap: 8px; }
</style>
</head>
<body>

  <div class="center section">
    ${kitchenBanner}
  </div>

  <table class="meta section">
    <tr>
      <td><span class="meta-label">Date</span> ${dateStr} · ${timeStr}</td>
      <td style="text-align:right;" class="order-id">${orderId}</td>
    </tr>
    <tr><td colspan="2" style="padding-top:8px;"><span class="meta-label">Type</span> ${orderType ?? "Delivery"}</td></tr>
    ${tableRow}
    <tr><td colspan="2" style="padding-top:8px;"><span class="meta-label">Customer</span> ${customer?.name || "—"}</td></tr>
    <tr><td colspan="2" style="padding-top:4px;"><span class="meta-label">Mobile</span> ${customer?.phone || "—"}</td></tr>
    ${notes ? `<tr><td colspan="2" style="padding-top:4px;"><span class="meta-label">Notes</span> ${notes}</td></tr>` : ""}
  </table>

  ${instructions ? `<div class="notes-block"><span class="meta-label">Instructions</span> ${instructions}</div>` : ""}

  <table class="items section">
    <thead>${itemHeader}</thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="grand-total">
    <span>${totalLabel}</span>
    <span>${isKitchen ? `${displayItems.length} line(s)` : `Rs ${displayTotal.toFixed(0)}`}</span>
  </div>
  ${isKitchen ? `<div class="grand-total" style="margin-top:8px; padding-top:8px; border-top:1px dashed #999; font-size:14px;"><span>Qty total</span><span>${displayItems.reduce((s, i) => s + i.quantity, 0)}</span></div>` : ""}

  ${paymentBlock}

</body>
</html>`;
}

/** Opens the browser print dialog for HTML, then resolves when printing finishes. */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.title = "Receipt Print";
    iframe.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:80mm;height:1px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.setTimeout(() => {
        iframe.remove();
        resolve();
      }, 150);
    };

    const onAfterPrint = () => finish();
    const fallback = window.setTimeout(finish, 4000);

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        window.clearTimeout(fallback);
        finish();
        return;
      }
      win.addEventListener("afterprint", onAfterPrint, { once: true });
      win.focus();
      win.print();
    };

    iframe.srcdoc = html;
  });
}

export async function printOrderReceipts(
  cartItems: CartItem[],
  totalPrice: number,
  notes: string,
  instructions: string,
  orderId: string,
  isPaid: boolean,
  customer?: { name: string; phone: string },
  orderType?: string,
  tableNumber?: number | null,
): Promise<void> {
  const common = [
    cartItems,
    totalPrice,
    notes,
    instructions,
    orderId,
    isPaid,
    customer,
    orderType,
    tableNumber,
  ] as const;

  const customerHtml = buildReceiptHTML(...common, "customer");
  await printHtml(customerHtml);

  if (hasBarBqItems(cartItems)) {
    const kitchenHtml = buildReceiptHTML(...common, "bbq-kitchen");
    await printHtml(kitchenHtml);
  }
}
