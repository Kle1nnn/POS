"use client";
import { useEffect, useRef, useState, useCallback } from "react";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    qz: any;
  }
}

export type QZStatus = "loading" | "ready" | "connected" | "error";

export function useQZPrinter() {
  const [status, setStatus] = useState<QZStatus>("loading");
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const connectionAttempted = useRef(false);

  // Load QZ Tray script from CDN once
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.qz) {
      setStatus("ready");
      return;
    }

    const existing = document.getElementById("qz-tray-script");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "qz-tray-script";
    script.src = "https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js";
    script.async = true;
    script.onload = () => setStatus("ready");
    script.onerror = () => {
      setStatus("error");
      setErrorMsg("Failed to load QZ Tray script.");
    };
    document.head.appendChild(script);
  }, []);

  // Connect to QZ Tray desktop app
  const connect = useCallback(async () => {
    if (!window.qz) {
      setErrorMsg("QZ Tray script not loaded yet.");
      return false;
    }
    try {
      if (window.qz.websocket.isActive()) {
        setStatus("connected");
        return true;
      }
      await window.qz.websocket.connect();
      setStatus("connected");

      // Fetch available printers
      const list: string[] = await window.qz.printers.find();
      setPrinters(list);
      if (list.length > 0) setSelectedPrinter(list[0]);
      return true;
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not connect to QZ Tray.";
      setErrorMsg(msg);
      setStatus("error");
      return false;
    }
  }, []);

  // Auto-connect once script is ready
  useEffect(() => {
    if (status === "ready" && !connectionAttempted.current) {
      connectionAttempted.current = true;
      connect();
    }
  }, [status, connect]);

  /**
   * Print raw HTML to the selected printer via QZ Tray.
   * QZ renders the HTML in a hidden iframe and sends it to the printer.
   */
  const printHTML = useCallback(
    async (htmlContent: string, printerOverride?: string) => {
      const printer = printerOverride || selectedPrinter;
      if (!window.qz || !window.qz.websocket.isActive()) {
        throw new Error("QZ Tray is not connected.");
      }
      if (!printer) {
        throw new Error("No printer selected.");
      }

      const config = window.qz.configs.create(printer, {
        colorType: "grayscale",
        copies: 1,
      });

      const data = [
        {
          type: "pixel",
          format: "html",
          flavor: "plain",
          data: htmlContent,
        },
      ];

      await window.qz.print(config, data);
    },
    [selectedPrinter],
  );

  return {
    status,
    printers,
    selectedPrinter,
    setSelectedPrinter,
    errorMsg,
    connect,
    printHTML,
  };
}
