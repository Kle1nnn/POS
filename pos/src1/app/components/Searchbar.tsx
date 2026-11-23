"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, ScanBarcode, Search, X } from "lucide-react";
import { useOrders } from "../context/OrdersContext";

interface SearchbarProps {
  value: string;
  onChange: (value: string) => void;
  barcodeSearchEnabled?: boolean;
  digitalClockEnabled?: boolean;
  onSubmit?: (value: string) => void;
}

export default function Searchbar({
  value,
  onChange,
  barcodeSearchEnabled = true,
  digitalClockEnabled = true,
  onSubmit,
}: SearchbarProps) {
  const router = useRouter();
  const { savedOrders } = useOrders();
  const savedOrderCount = savedOrders.length;

  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initTimer = window.setTimeout(() => setNow(new Date()), 0);
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(intervalId);
    };
  }, []);

  const hours24 = now ? now.getHours() : 0;
  const clockAmPm = now ? (hours24 >= 12 ? "PM" : "AM") : "--";
  const hours12 = hours24 % 12 || 12;
  const clockTimeText = now
    ? `${String(hours12).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`
    : "--:--:--";
  const clockDateText = now
    ? now.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "---, -- ---";

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-x-4 gap-y-2 flex-wrap w-full px-4 pt-3 pb-2 bg-[#f0f2f5]">
      <div className="min-w-0">
        <div className="font-bold text-xl text-yellow-900 mt-0.5 leading-snug">
          Tasty Bites Pizza Fast Food and BarBQ Tharushah
        </div>
        <div className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">
          ---------------Choose Category---------------
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 ml-auto">
        {digitalClockEnabled && (
          <div
            suppressHydrationWarning
            aria-label="Digital clock"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white shadow-xs"
          >
            <Clock
              className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0"
              aria-hidden="true"
            />
            <span
              suppressHydrationWarning
              className="font-mono text-sm font-bold tracking-wider text-emerald-400 tabular-nums leading-none"
            >
              {clockTimeText}
            </span>
            <span
              suppressHydrationWarning
              className="font-mono text-[10px] font-semibold text-slate-300 uppercase leading-none"
            >
              {clockAmPm}
            </span>
            <span className="text-slate-600 text-xs leading-none" aria-hidden="true">
              ·
            </span>
            <span
              suppressHydrationWarning
              className="text-[11px] font-medium text-slate-300 whitespace-nowrap leading-none"
            >
              {clockDateText}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={() => router.push("/Orders")}
            className="px-3 py-2 rounded-full bg-[#1a3a5c] text-white text-xs font-semibold hover:bg-[#1565c0] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title={
              savedOrderCount > 0
                ? `Orders — ${savedOrderCount} saved order${savedOrderCount === 1 ? "" : "s"} (Alt+O)`
                : "Orders (Alt+O)"
            }
          >
            <span>Orders</span>
            {savedOrderCount > 0 && (
              <span
                aria-label={`${savedOrderCount} saved orders`}
                className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-400 text-gray-950 font-mono text-[10px] font-bold leading-none tabular-nums"
              >
                {savedOrderCount}
              </span>
            )}
            <kbd className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono font-normal">
              Alt+O
            </kbd>
          </button>
          <button
            onClick={() => router.push("/History")}
            className="px-3 py-2 rounded-full bg-[#1a5c2a] text-white text-xs font-semibold hover:bg-green-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            title="History (Alt+H)"
          >
            <span>History</span>
            <kbd className="text-[10px] bg-white/20 px-1 py-0.2 rounded font-mono font-normal">
              Alt+H
            </kbd>
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="px-3 py-2 rounded-full bg-gray-800 text-white text-xs font-semibold hover:bg-gray-700 transition-colors whitespace-nowrap shrink-0"
          >
            Settings
          </button>
          <div
            className="flex items-center bg-white rounded-full px-3.5 py-2 shadow-sm border border-gray-200 w-52 lg:w-64 xl:w-72 focus-within:border-[#1565c0] transition-colors"
            title={
              barcodeSearchEnabled
                ? "Search by name, SKU, or scan barcode"
                : "Search by product name or SKU (barcode search disabled in Settings)"
            }
          >
            {barcodeSearchEnabled ? (
              <ScanBarcode
                className="w-4 h-4 text-[#1565c0] mr-2 flex-shrink-0"
                aria-hidden="true"
              />
            ) : (
              <Search
                className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0"
                aria-hidden="true"
              />
            )}
            <input
              type="text"
              placeholder={
                barcodeSearchEnabled
                  ? "Enter Product name / SKU / Barcode"
                  : "Enter Product name / SKU"
              }
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSubmit?.(value);
                }
              }}
              className="w-full text-xs text-gray-700 placeholder:text-gray-400 bg-transparent outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Clear search"
                className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
