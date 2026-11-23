export type MenuAppearanceSettings = {
  tileSize: number;
  tileBgColor: string;
  tileTextColor: string;
  tileBorderColor: string;
  fontFamily: string;
  fontSize: number;
};

export const DEFAULT_MENU_APPEARANCE: MenuAppearanceSettings = {
  tileSize: 90,
  tileBgColor: "#dce8f5",
  tileTextColor: "#1a3a5c",
  tileBorderColor: "#4a7aa8",
  fontFamily: "system-ui, sans-serif",
  fontSize: 11.5,
};

export const MENU_FONT_OPTIONS = [
  { value: "system-ui, sans-serif", label: "System" },
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "'Trebuchet MS', sans-serif", label: "Trebuchet" },
  { value: "'Courier New', monospace", label: "Courier New" },
] as const;

export function clampTileSize(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_MENU_APPEARANCE.tileSize;
  return Math.min(160, Math.max(60, Math.round(n)));
}

export function clampFontSize(n: number) {
  if (!Number.isFinite(n)) return DEFAULT_MENU_APPEARANCE.fontSize;
  return Math.min(18, Math.max(8, Math.round(n * 10) / 10));
}

export function normalizeHexColor(value: string, fallback: string) {
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}
