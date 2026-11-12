"use client";
import { useEffect, useState } from "react";
import Searchbar from "./components/Searchbar";
import MenuGrid from "./components/MenuGrid";
import {
  DEFAULT_POS_SETTINGS,
  POS_SETTINGS_CHANGED_EVENT,
  type PosSettings,
} from "../lib/pos-settings-shared";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [barcodeSearchEnabled, setBarcodeSearchEnabled] = useState(
    DEFAULT_POS_SETTINGS.barcodeSearchEnabled,
  );
  const [digitalClockEnabled, setDigitalClockEnabled] = useState(
    DEFAULT_POS_SETTINGS.digitalClockEnabled,
  );
  const [scanSubmitCount, setScanSubmitCount] = useState(0);

  useEffect(() => {
    let active = true;
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
          if (typeof data.settings.digitalClockEnabled === "boolean") {
            setDigitalClockEnabled(data.settings.digitalClockEnabled);
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
        if (typeof custom.detail.digitalClockEnabled === "boolean") {
          setDigitalClockEnabled(custom.detail.digitalClockEnabled);
        }
      } else {
        void fetchSettings();
      }
    };

    const onFocus = () => {
      void fetchSettings();
    };

    window.addEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener(POS_SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div className="min-h-screen font-sans bg-[#f0f2f5]">
      <Searchbar
        value={searchQuery}
        onChange={setSearchQuery}
        barcodeSearchEnabled={barcodeSearchEnabled}
        digitalClockEnabled={digitalClockEnabled}
        onSubmit={() => setScanSubmitCount((c) => c + 1)}
      />
      <MenuGrid
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        barcodeSearchEnabled={barcodeSearchEnabled}
        scanSubmitCount={scanSubmitCount}
      />
    </div>
  );
}
