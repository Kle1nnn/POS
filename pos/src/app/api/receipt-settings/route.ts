import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";
import {
  DEFAULT_RECEIPT_SETTINGS,
  ensureReceiptSettingsTable,
  loadReceiptSettings,
  mapReceiptSettings,
} from "../../../lib/receipt-settings";

// GET /api/receipt-settings
export async function GET() {
  try {
    const settings = await loadReceiptSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to load receipt settings", err);
    return NextResponse.json(
      { error: "Failed to load receipt settings", settings: DEFAULT_RECEIPT_SETTINGS },
      { status: 500 },
    );
  }
}

// PUT /api/receipt-settings
export async function PUT(req: NextRequest) {
  let client;
  try {
    const body = (await req.json()) as Partial<{
      storeName: string;
      storeAddress: string;
      storePhones: string;
      logoImage: string;
      paymentTitle: string;
      paymentImage: string;
      paymentLine: string;
    }>;

    const storeName = body.storeName?.trim() || DEFAULT_RECEIPT_SETTINGS.storeName;
    const storeAddress =
      body.storeAddress?.trim() || DEFAULT_RECEIPT_SETTINGS.storeAddress;
    const storePhones =
      body.storePhones?.trim() || DEFAULT_RECEIPT_SETTINGS.storePhones;
    const logoImage =
      body.logoImage?.trim() || DEFAULT_RECEIPT_SETTINGS.logoImage;
    const paymentTitle =
      body.paymentTitle?.trim() || DEFAULT_RECEIPT_SETTINGS.paymentTitle;
    const paymentImage =
      body.paymentImage?.trim() || DEFAULT_RECEIPT_SETTINGS.paymentImage;
    const paymentLine =
      body.paymentLine?.trim() || DEFAULT_RECEIPT_SETTINGS.paymentLine;

    await ensureReceiptSettingsTable();
    client = await pgPool.connect();

    const result = await client.query(
      `INSERT INTO receipt_settings
         (id, store_name, store_address, store_phones, logo_image,
          payment_title, payment_image, payment_line, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         store_name = EXCLUDED.store_name,
         store_address = EXCLUDED.store_address,
         store_phones = EXCLUDED.store_phones,
         logo_image = EXCLUDED.logo_image,
         payment_title = EXCLUDED.payment_title,
         payment_image = EXCLUDED.payment_image,
         payment_line = EXCLUDED.payment_line,
         updated_at = NOW()
       RETURNING store_name, store_address, store_phones, logo_image,
                 payment_title, payment_image, payment_line`,
      [
        storeName,
        storeAddress,
        storePhones,
        logoImage,
        paymentTitle,
        paymentImage,
        paymentLine,
      ],
    );

    return NextResponse.json(
      { settings: mapReceiptSettings(result.rows[0]) },
      { status: 200 },
    );
  } catch (err) {
    console.error("Failed to save receipt settings", err);
    return NextResponse.json(
      { error: "Failed to save receipt settings" },
      { status: 500 },
    );
  } finally {
    if (client) client.release();
  }
}
