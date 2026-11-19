export type PosSettings = {
  barcodeSearchEnabled: boolean;
  digitalClockEnabled: boolean;
  lowStockThreshold: number;
  tableManagementEnabled: boolean;
  menuLogoImage: string;
  menuHeaderText: string;
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  barcodeSearchEnabled: true,
  digitalClockEnabled: true,
  lowStockThreshold: 5,
  tableManagementEnabled: true,
  menuLogoImage: "",
  menuHeaderText: "Menu",
};

export const POS_SETTINGS_CHANGED_EVENT = "pos-settings-changed";
export const LOW_STOCK_THRESHOLD_STORAGE_KEY = "pos_low_stock_threshold";
export const LOW_STOCK_THRESHOLD_CHANGED_EVENT = "pos_low_stock_threshold_changed";
