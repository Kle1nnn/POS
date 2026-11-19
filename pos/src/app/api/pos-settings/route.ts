import { NextRequest, NextResponse } from "next/server";
import { loadPosSettings, savePosSettings } from "../../../lib/pos-settings";

export async function GET() {
  try {
    const settings = await loadPosSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to load POS settings", err);
    return NextResponse.json(
      { error: "Failed to load POS settings" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      barcodeSearchEnabled?: unknown;
      digitalClockEnabled?: unknown;
      lowStockThreshold?: unknown;
      tableManagementEnabled?: unknown;
      menuLogoImage?: unknown;
      menuHeaderText?: unknown;
    };

    const hasBarcode = typeof body.barcodeSearchEnabled === "boolean";
    const hasClock = typeof body.digitalClockEnabled === "boolean";
    const hasTableManagement = typeof body.tableManagementEnabled === "boolean";
    const hasMenuLogo = typeof body.menuLogoImage === "string";
    const hasMenuText = typeof body.menuHeaderText === "string";
    const parsedThreshold =
      typeof body.lowStockThreshold === "number" &&
      Number.isFinite(body.lowStockThreshold) &&
      body.lowStockThreshold >= 0
        ? Math.min(9999, Math.floor(body.lowStockThreshold))
        : null;
    const hasThreshold = parsedThreshold !== null;

    if (
      !hasBarcode &&
      !hasClock &&
      !hasThreshold &&
      !hasTableManagement &&
      !hasMenuLogo &&
      !hasMenuText
    ) {
      return NextResponse.json(
        {
          error:
            "At least one valid setting is required",
        },
        { status: 400 },
      );
    }

    const settings = await savePosSettings({
      ...(hasBarcode
        ? { barcodeSearchEnabled: body.barcodeSearchEnabled as boolean }
        : {}),
      ...(hasClock
        ? { digitalClockEnabled: body.digitalClockEnabled as boolean }
        : {}),
      ...(hasThreshold ? { lowStockThreshold: parsedThreshold } : {}),
      ...(hasTableManagement
        ? { tableManagementEnabled: body.tableManagementEnabled as boolean }
        : {}),
      ...(hasMenuLogo ? { menuLogoImage: body.menuLogoImage as string } : {}),
      ...(hasMenuText
        ? { menuHeaderText: body.menuHeaderText as string }
        : {}),
    });
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to update POS settings", err);
    return NextResponse.json(
      { error: "Failed to update POS settings" },
      { status: 500 },
    );
  }
}
