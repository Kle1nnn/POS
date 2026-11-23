import { pgPool } from "./db";
import {
  DEFAULT_MENU_APPEARANCE,
  clampFontSize,
  clampTileSize,
  normalizeHexColor,
  type MenuAppearanceSettings,
} from "./menu-appearance-shared";

export type { MenuAppearanceSettings };
export {
  DEFAULT_MENU_APPEARANCE,
  MENU_FONT_OPTIONS,
  clampFontSize,
  clampTileSize,
  normalizeHexColor,
} from "./menu-appearance-shared";

let ready: Promise<void> | null = null;

export function ensureMenuAppearanceTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      const client = await pgPool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS menu_appearance_settings (
            id               integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            tile_size        integer NOT NULL DEFAULT 90,
            tile_bg_color    text NOT NULL DEFAULT '#dce8f5',
            tile_text_color  text NOT NULL DEFAULT '#1a3a5c',
            tile_border_color text NOT NULL DEFAULT '#4a7aa8',
            font_family      text NOT NULL DEFAULT 'system-ui, sans-serif',
            font_size        numeric(4,1) NOT NULL DEFAULT 11.5,
            updated_at       timestamptz NOT NULL DEFAULT NOW()
          );
        `);
        await client.query(`
          INSERT INTO menu_appearance_settings (id)
          VALUES (1)
          ON CONFLICT (id) DO NOTHING;
        `);
      } finally {
        client.release();
      }
    })();
  }
  return ready;
}

function mapRow(row: Record<string, unknown>): MenuAppearanceSettings {
  return {
    tileSize: clampTileSize(Number(row.tile_size)),
    tileBgColor: normalizeHexColor(
      String(row.tile_bg_color || ""),
      DEFAULT_MENU_APPEARANCE.tileBgColor,
    ),
    tileTextColor: normalizeHexColor(
      String(row.tile_text_color || ""),
      DEFAULT_MENU_APPEARANCE.tileTextColor,
    ),
    tileBorderColor: normalizeHexColor(
      String(row.tile_border_color || ""),
      DEFAULT_MENU_APPEARANCE.tileBorderColor,
    ),
    fontFamily:
      String(row.font_family || "").trim() ||
      DEFAULT_MENU_APPEARANCE.fontFamily,
    fontSize: clampFontSize(Number(row.font_size)),
  };
}

export async function loadMenuAppearance(): Promise<MenuAppearanceSettings> {
  await ensureMenuAppearanceTable();
  const client = await pgPool.connect();
  try {
    const result = await client.query(
      `SELECT tile_size, tile_bg_color, tile_text_color, tile_border_color,
              font_family, font_size
       FROM menu_appearance_settings WHERE id = 1`,
    );
    if (!result.rows[0]) return { ...DEFAULT_MENU_APPEARANCE };
    return mapRow(result.rows[0]);
  } finally {
    client.release();
  }
}

export async function saveMenuAppearance(
  input: Partial<MenuAppearanceSettings>,
): Promise<MenuAppearanceSettings> {
  await ensureMenuAppearanceTable();
  const current = await loadMenuAppearance();
  const next: MenuAppearanceSettings = {
    tileSize:
      input.tileSize !== undefined
        ? clampTileSize(Number(input.tileSize))
        : current.tileSize,
    tileBgColor:
      input.tileBgColor !== undefined
        ? normalizeHexColor(input.tileBgColor, current.tileBgColor)
        : current.tileBgColor,
    tileTextColor:
      input.tileTextColor !== undefined
        ? normalizeHexColor(input.tileTextColor, current.tileTextColor)
        : current.tileTextColor,
    tileBorderColor:
      input.tileBorderColor !== undefined
        ? normalizeHexColor(input.tileBorderColor, current.tileBorderColor)
        : current.tileBorderColor,
    fontFamily:
      input.fontFamily !== undefined
        ? input.fontFamily.trim() || current.fontFamily
        : current.fontFamily,
    fontSize:
      input.fontSize !== undefined
        ? clampFontSize(Number(input.fontSize))
        : current.fontSize,
  };

  const client = await pgPool.connect();
  try {
    const result = await client.query(
      `
      UPDATE menu_appearance_settings
      SET tile_size = $1,
          tile_bg_color = $2,
          tile_text_color = $3,
          tile_border_color = $4,
          font_family = $5,
          font_size = $6,
          updated_at = NOW()
      WHERE id = 1
      RETURNING tile_size, tile_bg_color, tile_text_color, tile_border_color,
                font_family, font_size
      `,
      [
        next.tileSize,
        next.tileBgColor,
        next.tileTextColor,
        next.tileBorderColor,
        next.fontFamily,
        next.fontSize,
      ],
    );
    return mapRow(result.rows[0]);
  } finally {
    client.release();
  }
}
