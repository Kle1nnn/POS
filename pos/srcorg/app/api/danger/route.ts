import { NextRequest, NextResponse } from "next/server";
import {
  getWipeCode,
  setWipeCode,
  wipeAllTransactionalData,
} from "../../../lib/danger-settings";

// GET /api/danger — whether a wipe code is configured (never returns the code)
export async function GET() {
  try {
    const code = await getWipeCode();
    return NextResponse.json(
      {
        codeSet: code.length > 0,
        codeLength: code.length,
        hint: code.length >= 2 ? `${code.slice(0, 1)}${"*".repeat(Math.max(0, code.length - 2))}${code.slice(-1)}` : "****",
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load danger settings", err);
    return NextResponse.json(
      { error: "Failed to load danger settings" },
      { status: 500 },
    );
  }
}

// PUT /api/danger — set confirmation code { currentCode?, newCode }
export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      currentCode?: string;
      newCode?: string;
    };
    if (!body.newCode?.trim()) {
      return NextResponse.json(
        { error: "newCode is required" },
        { status: 400 },
      );
    }

    const existing = await getWipeCode();
    // First-time or when changing: require current code if one already exists
    if (existing && body.currentCode?.trim() !== existing) {
      return NextResponse.json(
        { error: "Current confirmation code is incorrect" },
        { status: 403 },
      );
    }

    await setWipeCode(body.newCode);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Failed to set wipe code", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to set confirmation code",
      },
      { status: 500 },
    );
  }
}

// POST /api/danger — wipe all data { confirmationCode }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { confirmationCode?: string };
    if (!body.confirmationCode?.trim()) {
      return NextResponse.json(
        { error: "confirmationCode is required" },
        { status: 400 },
      );
    }

    const result = await wipeAllTransactionalData(body.confirmationCode);
    return NextResponse.json({ success: true, wiped: result }, { status: 200 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to wipe data";
    const status = message === "Invalid confirmation code" ? 403 : 500;
    console.error("Failed to wipe data", err);
    return NextResponse.json({ error: message }, { status });
  }
}
