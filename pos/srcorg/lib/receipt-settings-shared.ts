export type ReceiptSettings = {
  storeName: string;
  storeAddress: string;
  storePhones: string;
  logoImage: string;
  paymentTitle: string;
  paymentImage: string;
  paymentLine: string;
  receiptPrefix: string;
  receiptNextNumber: number;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: "Tasty Bites Pizza, BarBQ & Fast Food",
  storeAddress: "Kamran Centre, Tharushah",
  storePhones: "03213611550 · 03063096900",
  logoImage: "logo.png",
  paymentTitle: "Online payment",
  paymentImage: "Jz.jpg",
  paymentLine: "JazzCash 03213611550 M.Saleh",
  receiptPrefix: "TBT",
  receiptNextNumber: 1,
};

export function normalizeReceiptPrefix(value: string) {
  const cleaned = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return cleaned || DEFAULT_RECEIPT_SETTINGS.receiptPrefix;
}

export function formatReceiptCode(prefix: string, num: number) {
  return `${normalizeReceiptPrefix(prefix)}-${Math.max(1, Math.floor(num))}`;
}
