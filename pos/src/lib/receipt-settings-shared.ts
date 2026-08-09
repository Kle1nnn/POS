export type ReceiptSettings = {
  storeName: string;
  storeAddress: string;
  storePhones: string;
  logoImage: string;
  paymentTitle: string;
  paymentImage: string;
  paymentLine: string;
};

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: "Tasty Bites Pizza, BarBQ & Fast Food",
  storeAddress: "Kamran Centre, Tharushah",
  storePhones: "03213611550 · 03063096900",
  logoImage: "logo.png",
  paymentTitle: "Online payment",
  paymentImage: "Jz.jpg",
  paymentLine: "JazzCash 03213611550 M.Saleh",
};
