import { NextRequest, NextResponse } from "next/server";
import {
  getAutoBackupSettings,
  getBackupsFolderPath,
  isValidTime,
  listRecentAutoBackups,
  runContactsAutoBackup,
  runFullAutoBackup,
  startAutoBackupScheduler,
  updateAutoBackupSettings,
} from "../../../../lib/auto-backup";

startAutoBackupScheduler();

// GET /api/backup/auto — settings + recent files
export async function GET() {
  try {
    const [settings, recent] = await Promise.all([
      getAutoBackupSettings(),
      listRecentAutoBackups(20),
    ]);
    return NextResponse.json(
      {
        settings,
        folder: getBackupsFolderPath(),
        recent,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to load auto backup settings", err);
    return NextResponse.json(
      { error: "Failed to load auto backup settings" },
      { status: 500 },
    );
  }
}

// POST /api/backup/auto
// body: { contactsEnabled?, fullEnabled?, contactsTime?, fullTime?, run?: "contacts"|"full" }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      contactsEnabled?: boolean;
      fullEnabled?: boolean;
      contactsTime?: string;
      fullTime?: string;
      run?: "contacts" | "full";
    };

    if (body.run === "contacts") {
      const result = await runContactsAutoBackup();
      const settings = await getAutoBackupSettings();
      return NextResponse.json(
        { success: true, ran: "contacts", result, settings },
        { status: 200 },
      );
    }
    if (body.run === "full") {
      const result = await runFullAutoBackup();
      const settings = await getAutoBackupSettings();
      return NextResponse.json(
        { success: true, ran: "full", result, settings },
        { status: 200 },
      );
    }

    if (body.contactsTime != null && !isValidTime(body.contactsTime)) {
      return NextResponse.json(
        { error: "contactsTime must be HH:MM (24-hour)" },
        { status: 400 },
      );
    }
    if (body.fullTime != null && !isValidTime(body.fullTime)) {
      return NextResponse.json(
        { error: "fullTime must be HH:MM (24-hour)" },
        { status: 400 },
      );
    }

    const settings = await updateAutoBackupSettings({
      contactsEnabled: body.contactsEnabled,
      fullEnabled: body.fullEnabled,
      contactsTime: body.contactsTime,
      fullTime: body.fullTime,
    });

    return NextResponse.json({ success: true, settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to update auto backup settings", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update auto backup settings",
      },
      { status: 500 },
    );
  }
}
