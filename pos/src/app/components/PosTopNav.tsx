"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  House,
  Settings,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import { useOrders } from "../context/OrdersContext";
import {
  DEFAULT_POS_SETTINGS,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../../lib/pos-settings-shared";
import {
  DEFAULT_SHORTCUTS,
  SHORTCUTS_CHANGED_EVENT,
  getShortcuts,
  type ShortcutsMap,
} from "../../lib/shortcuts";

export type PosNavPage = "menu" | "orders" | "history" | "settings";

interface PosTopNavProps {
  activePage: PosNavPage;
  title: string;
  subtitle?: string;
  sticky?: boolean;
}

const NAV_BTN_BASE =
  "h-9 w-[84px] px-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 whitespace-nowrap shrink-0 transition-colors active:scale-95";

function resolveLogoSrc(image: string) {
  if (!image) return "";
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/${image}`;
}

export default function PosTopNav({
  activePage,
  title,
  subtitle,
  sticky = true,
}: PosTopNavProps) {
  const router = useRouter();
  const { savedOrders } = useOrders();
  const savedOrderCount = savedOrders.length;
  const [shortcuts, setShortcuts] = useState<ShortcutsMap>(DEFAULT_SHORTCUTS);
  const [menuLogoImage, setMenuLogoImage] = useState(
    DEFAULT_POS_SETTINGS.menuLogoImage,
  );
  const [menuHeaderText, setMenuHeaderText] = useState(
    DEFAULT_POS_SETTINGS.menuHeaderText,
  );
  const [logoImgFailed, setLogoImgFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (!active) return;
      setShortcuts(getShortcuts());
    }, 0);

    const fetchBranding = async () => {
      try {
        const res = await fetch("/api/pos-settings");
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as {
          settings?: PosSettings;
        };
        if (active && data.settings) {
          if (typeof data.settings.menuLogoImage === "string") {
            setMenuLogoImage(data.settings.menuLogoImage);
            setLogoImgFailed(false);
          }
          if (typeof data.settings.menuHeaderText === "string") {
            setMenuHeaderText(
              data.settings.menuHeaderText.trim() ||
                DEFAULT_POS_SETTINGS.menuHeaderText,
            );
          }
        }
      } catch {
        /* ignore */
      }
    };

    void fetchBranding();

    const onSettingsChanged = (e: Event) => {
      const custom = e as CustomEvent<PosSettings>;
      if (custom.detail) {
        if (typeof custom.detail.menuLogoImage === "string") {
          setMenuLogoImage(custom.detail.menuLogoImage);
          setLogoImgFailed(false);
        }
        if (typeof custom.detail.menuHeaderText === "string") {
          setMenuHeaderText(
            custom.detail.menuHeaderText.trim() ||
              DEFAULT_POS_SETTINGS.menuHeaderText,
          );
        }
      } else {
        void fetchBranding();
      }
    };

    const onShortcutsChanged = () => {
      setShortcuts(getShortcuts());
    };
    const onFocus = () => {
      void fetchBranding();
    };
    window.addEventListener(SHORTCUTS_CHANGED_EVENT, onShortcutsChanged);
    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.removeEventListener(SHORTCUTS_CHANGED_EVENT, onShortcutsChanged);
      window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const displayTitle =
    activePage === "menu" ? menuHeaderText || title : title;
  const menuLogoSrc =
    activePage === "menu" && menuLogoImage && !logoImgFailed
      ? resolveLogoSrc(menuLogoImage)
      : "";

  return (
    <header
      className={`${
        sticky ? "sticky top-0 z-30" : "relative z-30"
      } bg-white border-b border-gray-200 px-5 min-h-[58px] py-2 flex items-center justify-between gap-3`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {menuLogoSrc ? (
          <img
            src={menuLogoSrc}
            alt={displayTitle}
            onError={() => setLogoImgFailed(true)}
            className="w-8 h-8 rounded-lg object-contain border border-gray-200 bg-white shrink-0"
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-gray-200 text-slate-800 flex items-center justify-center shrink-0">
            {activePage === "menu" ? (
              <UtensilsCrossed className="w-4 h-4" aria-hidden="true" />
            ) : activePage === "orders" ? (
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
            ) : activePage === "history" ? (
              <Clock className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Settings className="w-4 h-4" aria-hidden="true" />
            )}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate leading-tight">
            {displayTitle}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-gray-500 truncate leading-tight tabular-nums">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <nav
        aria-label="Primary navigation"
        className="flex items-center gap-1.5 shrink-0 ml-auto"
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-current={activePage === "menu" ? "page" : undefined}
          title="Menu"
          className={`${NAV_BTN_BASE} bg-[#1a3a5c] text-white hover:bg-[#1565c0] ${
            activePage === "menu" ? "ring-2 ring-offset-1 ring-slate-900" : ""
          }`}
        >
          <House className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Menu</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/Orders")}
          aria-current={activePage === "orders" ? "page" : undefined}
          title={
            savedOrderCount > 0
              ? `Orders — ${savedOrderCount} saved order${savedOrderCount === 1 ? "" : "s"} (${shortcuts.orders.label})`
              : `Orders (${shortcuts.orders.label})`
          }
          className={`${NAV_BTN_BASE} relative bg-[#7a4a00] text-white hover:bg-amber-700 ${
            activePage === "orders" ? "ring-2 ring-offset-1 ring-slate-900" : ""
          }`}
        >
          {savedOrderCount > 0 && (
            <span
              aria-label={`${savedOrderCount} saved orders`}
              className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-amber-400 text-gray-950 border-2 border-white font-mono text-[10px] font-bold leading-none tabular-nums pointer-events-none"
            >
              {savedOrderCount}
            </span>
          )}
          <ShoppingCart className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Orders</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/History")}
          aria-current={activePage === "history" ? "page" : undefined}
          title={`History (${shortcuts.history.label})`}
          className={`${NAV_BTN_BASE} bg-[#1a5c2a] text-white hover:bg-green-700 ${
            activePage === "history" ? "ring-2 ring-offset-1 ring-slate-900" : ""
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>History</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/settings")}
          aria-current={activePage === "settings" ? "page" : undefined}
          title={`Settings (${shortcuts.settings.label})`}
          className={`${NAV_BTN_BASE} bg-gray-800 text-white hover:bg-gray-700 ${
            activePage === "settings"
              ? "ring-2 ring-offset-1 ring-slate-900"
              : ""
          }`}
        >
          <Settings className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
    </header>
  );
}
