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
    };

    const hasBarcode = typeof body.barcodeSearchEnabled === "boolean";
    const hasClock = typeof body.digitalClockEnabled === "boolean";

    if (!hasBarcode && !hasClock) {
      return NextResponse.json(
        {
          error:
            "At least one boolean setting (barcodeSearchEnabled or digitalClockEnabled) is required",
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
