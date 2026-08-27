import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MENU_APPEARANCE,
  loadMenuAppearance,
  saveMenuAppearance,
} from "../../../lib/menu-appearance";

// GET /api/menu-appearance
export async function GET() {
  try {
    const settings = await loadMenuAppearance();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to load menu appearance", err);
    return NextResponse.json(
      { error: "Failed to load menu appearance", settings: DEFAULT_MENU_APPEARANCE },
      { status: 500 },
    );
  }
}

// PUT /api/menu-appearance
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<{
      tileSize: number;
      tileBgColor: string;
      tileTextColor: string;
      tileBorderColor: string;
      fontFamily: string;
      fontSize: number;
    }>;
    const settings = await saveMenuAppearance(body);
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to save menu appearance", err);
    return NextResponse.json(
      { error: "Failed to save menu appearance" },
      { status: 500 },
    );
  }
}
