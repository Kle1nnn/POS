"use client";
import { useEffect, useState } from "react";
import PosTopNav from "./components/PosTopNav";
import MenuGrid from "./components/MenuGrid";
import { useCart } from "./context/CartContext";
import {
  DEFAULT_POS_SETTINGS,
  LOW_STOCK_THRESHOLD_CHANGED_EVENT,
  LOW_STOCK_THRESHOLD_STORAGE_KEY,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../lib/pos-settings-shared";

export default function Home() {
  const {
    productSearchQuery,
    setProductSearchQuery,
    scanSubmitCount,
  } = useCart();
  const [barcodeSearchEnabled, setBarcodeSearchEnabled] = useState(
    DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    DEFAULT_POS_SETTINGS.lowStockThreshold,
  );

  useEffect(() => {
    let active = true;

    const initThresholdTimer = window.setTimeout(() => {
      if (!active) return;
      try {
        const stored = localStorage.getItem(LOW_STOCK_THRESHOLD_STORAGE_KEY);
        if (stored !== null && stored !== "" && Number.isFinite(Number(stored))) {
          setLowStockThreshold(Math.max(0, Math.floor(Number(stored))));
        }
      } catch {
        /* ignore */
      }
    }, 0);

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/pos-settings");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          settings?: PosSettings;
        };
        if (active && data.settings) {
          if (typeof data.settings.barcodeSearchEnabled === "boolean") {
            setBarcodeSearchEnabled(data.settings.barcodeSearchEnabled);
          }
          if (
            typeof data.settings.lowStockThreshold === "number" &&
            Number.isFinite(data.settings.lowStockThreshold)
          ) {
            setLowStockThreshold(
              Math.max(0, Math.floor(data.settings.lowStockThreshold)),
            );
            try {
              localStorage.setItem(
                LOW_STOCK_THRESHOLD_STORAGE_KEY,
                String(Math.max(0, Math.floor(data.settings.lowStockThreshold))),
              );
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        // keep default
      }
    };

    void fetchSettings();

    const onSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent<PosSettings>;
      if (custom.detail) {
        if (typeof custom.detail.barcodeSearchEnabled === "boolean") {
          setBarcodeSearchEnabled(custom.detail.barcodeSearchEnabled);
        }
        if (
          typeof custom.detail.lowStockThreshold === "number" &&
          Number.isFinite(custom.detail.lowStockThreshold)
        ) {
          setLowStockThreshold(
            Math.max(0, Math.floor(custom.detail.lowStockThreshold)),
          );
        }
      } else {
        void fetchSettings();
      }
    };

    const onThresholdChanged = (e: Event) => {
      const custom = e as CustomEvent<number>;
      if (typeof custom.detail === "number" && Number.isFinite(custom.detail)) {
        setLowStockThreshold(Math.max(0, Math.floor(custom.detail)));
      } else {
        try {
          const stored = localStorage.getItem(LOW_STOCK_THRESHOLD_STORAGE_KEY);
          if (stored !== null && stored !== "" && Number.isFinite(Number(stored))) {
            setLowStockThreshold(Math.max(0, Math.floor(Number(stored))));
          }
        } catch {
          /* ignore */
        }
      }
    };

    const onFocus = () => {
      void fetchSettings();
    };

    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener(LOW_STOCK_THRESHOLD_CHANGED_EVENT, onThresholdChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearTimeout(initThresholdTimer);
      window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener(
        LOW_STOCK_THRESHOLD_CHANGED_EVENT,
        onThresholdChanged,
      );
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="min-h-screen font-sans bg-[#f0f2f5]">
      <PosTopNav activePage="menu" title="Menu" sticky={false} />
      <div className="pt-3">
        <MenuGrid
          searchQuery={productSearchQuery}
          onSearchChange={setProductSearchQuery}
          barcodeSearchEnabled={barcodeSearchEnabled}
          lowStockThreshold={lowStockThreshold}
          scanSubmitCount={scanSubmitCount}
        />
      </div>
    </div>
  );
}
