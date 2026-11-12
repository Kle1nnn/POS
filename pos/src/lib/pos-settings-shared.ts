export type PosSettings = {
  barcodeSearchEnabled: boolean;
  digitalClockEnabled: boolean;
};

export const DEFAULT_POS_SETTINGS: PosSettings = {
  barcodeSearchEnabled: true,
  digitalClockEnabled: true,
};

export const POS_SETTINGS_CHANGED_EVENT = "pos-settings-changed";
