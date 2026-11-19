"use client";

import * as XLSX from "xlsx";

export type DailyProductSaleExportRow = {
  name: string;
  category: string | null;
  selectedSize: string | null;
  selectedTopping: string | null;
  selectedSauce: string | null;
  quantitySold: number;
  revenue: number;
};

export type ItemReportExportRow = DailyProductSaleExportRow & {
  period?: string;
};

function formatVariant(item: DailyProductSaleExportRow): string {
  const parts: string[] = [];
  if (item.selectedSize && item.selectedSize !== "N/A") {
    parts.push(item.selectedSize);
  }
  if (item.selectedTopping && item.selectedTopping !== "None") {
    parts.push(item.selectedTopping);
  }
  if (item.selectedSauce && item.selectedSauce !== "None") {
    parts.push(item.selectedSauce);
  }
  return parts.join(" · ");
}

function autoFitColumns(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((key) => {
    let maxLen = key.length;
    for (const row of rows) {
      const val = row[key];
      const str = val == null ? "" : String(val);
      if (str.length > maxLen) maxLen = str.length;
    }
    return { wch: Math.min(48, Math.max(10, maxLen + 3)) };
  });
}

export function exportDailyProductSalesToExcel({
  businessDate,
  products,
  totalQuantity,
  totalRevenue,
}: {
  businessDate: string;
  products: DailyProductSaleExportRow[];
  totalQuantity: number;
  totalRevenue: number;
}) {
  const sortedProducts = [...products].sort((a, b) => {
    const catA = (a.category?.trim() || "Other").toLowerCase();
    const catB = (b.category?.trim() || "Other").toLowerCase();
    if (catA !== catB) return catA.localeCompare(catB);
    return b.revenue - a.revenue;
  });

  const productRows: Record<string, string | number>[] = sortedProducts.map(
    (item) => {
      const qty = Number(item.quantitySold) || 0;
      const rev = Number(item.revenue) || 0;
      const avg = qty > 0 ? Number((rev / qty).toFixed(2)) : 0;
      const share =
        totalRevenue > 0
          ? Number(((rev / totalRevenue) * 100).toFixed(1))
          : 0;
      return {
        "Business Date": businessDate || "—",
        Category: item.category?.trim() || "Other",
        "Product Name": item.name,
        Variant: formatVariant(item) || "Standard",
        "Quantity Sold": qty,
        "Avg Unit Price (Rs.)": avg,
        "Revenue (Rs.)": Number(rev.toFixed(2)),
        "Revenue Share (%)": share,
      };
    },
  );

  productRows.push({
    "Business Date": businessDate || "—",
    Category: "TOTAL",
    "Product Name": `${products.length} product line${products.length === 1 ? "" : "s"}`,
    Variant: "",
    "Quantity Sold": totalQuantity,
    "Avg Unit Price (Rs.)": "",
    "Revenue (Rs.)": Number(totalRevenue.toFixed(2)),
    "Revenue Share (%)": totalRevenue > 0 ? 100 : 0,
  });

  const categoryMap = new Map<
    string,
    { lines: number; qty: number; revenue: number }
  >();
  for (const item of products) {
    const cat = item.category?.trim() || "Other";
    const cur = categoryMap.get(cat) ?? { lines: 0, qty: 0, revenue: 0 };
    cur.lines += 1;
    cur.qty += Number(item.quantitySold) || 0;
    cur.revenue += Number(item.revenue) || 0;
    categoryMap.set(cat, cur);
  }

  const categoryRows: Record<string, string | number>[] = Array.from(
    categoryMap.entries(),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, stats]) => ({
      Category: category,
      "Product Lines": stats.lines,
      "Quantity Sold": stats.qty,
      "Revenue (Rs.)": Number(stats.revenue.toFixed(2)),
      "Revenue Share (%)":
        totalRevenue > 0
          ? Number(((stats.revenue / totalRevenue) * 100).toFixed(1))
          : 0,
    }));

  categoryRows.push({
    Category: "TOTAL",
    "Product Lines": products.length,
    "Quantity Sold": totalQuantity,
    "Revenue (Rs.)": Number(totalRevenue.toFixed(2)),
    "Revenue Share (%)": totalRevenue > 0 ? 100 : 0,
  });

  const wb = XLSX.utils.book_new();
  const productSheet = XLSX.utils.json_to_sheet(productRows);
  productSheet["!cols"] = autoFitColumns(productRows);
  XLSX.utils.book_append_sheet(wb, productSheet, "Product Sales");

  const categorySheet = XLSX.utils.json_to_sheet(categoryRows);
  categorySheet["!cols"] = autoFitColumns(categoryRows);
  XLSX.utils.book_append_sheet(wb, categorySheet, "Category Summary");

  const safeDate = (businessDate || new Date().toISOString().slice(0, 10)).replace(
    /[^0-9A-Za-z_-]/g,
    "-",
  );
  XLSX.writeFile(wb, `daily-product-sales-${safeDate}.xlsx`);
}

export function exportItemReportToExcel({
  periodLabel,
  includePeriod,
  rows,
  totalItems,
  totalRevenue,
}: {
  periodLabel: string;
  includePeriod: boolean;
  rows: ItemReportExportRow[];
  totalItems: number;
  totalRevenue: number;
}) {
  const sheetRows: Record<string, string | number>[] = rows.map((item) => {
    const qty = Number(item.quantitySold) || 0;
    const rev = Number(item.revenue) || 0;
    const base: Record<string, string | number> = {};
    if (includePeriod) {
      base.Period = item.period || periodLabel;
    }
    base["Product Name"] = item.name;
    base.Variant = formatVariant(item) || "Standard";
    base.Category = item.category?.trim() || "Other";
    base["Quantity Sold"] = qty;
    base["Revenue (Rs.)"] = Number(rev.toFixed(2));
    return base;
  });

  const summary: Record<string, string | number> = {};
  if (includePeriod) {
    summary.Period = periodLabel;
  }
  summary["Product Name"] = "TOTAL";
  summary.Variant = `${rows.length} lines`;
  summary.Category = "";
  summary["Quantity Sold"] = totalItems;
  summary["Revenue (Rs.)"] = Number(totalRevenue.toFixed(2));
  sheetRows.push(summary);

  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(sheetRows);
  sheet["!cols"] = autoFitColumns(sheetRows);
  XLSX.utils.book_append_sheet(wb, sheet, "Item Sales");

  const safeSlug = periodLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  XLSX.writeFile(wb, `item-sales-report-${safeSlug || "export"}.xlsx`);
}
