import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "../../../lib/db";
import {
  DEFAULT_RECEIPT_SETTINGS,
  ensureReceiptSettingsTable,
  loadReceiptSettings,
  mapReceiptSettings,
  normalizeReceiptPrefix,
} from "../../../lib/receipt-settings";

// GET /api/receipt-settings
export async function GET() {
  try {
    const settings = await loadReceiptSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    console.error("Failed to load receipt settings", err);
    return NextResponse.json(
      {
        error: "Failed to load receipt settings",
        settings: DEFAULT_RECEIPT_SETTINGS,
      },
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
      receiptPrefix: string;
      receiptNextNumber: number | string;
    }>;

    const current = await loadReceiptSettings();

    const storeName =
      body.storeName !== undefined
        ? body.storeName.trim() || DEFAULT_RECEIPT_SETTINGS.storeName
        : current.storeName;
    const storeAddress =
      body.storeAddress !== undefined
        ? body.storeAddress.trim() || DEFAULT_RECEIPT_SETTINGS.storeAddress
        : current.storeAddress;
    const storePhones =
      body.storePhones !== undefined
        ? body.storePhones.trim() || DEFAULT_RECEIPT_SETTINGS.storePhones
        : current.storePhones;
    const logoImage =
      body.logoImage !== undefined ? body.logoImage.trim() : current.logoImage;
    const paymentTitle =
      body.paymentTitle !== undefined
        ? body.paymentTitle.trim()
        : current.paymentTitle;
    const paymentImage =
      body.paymentImage !== undefined
        ? body.paymentImage.trim()
        : current.paymentImage;
    const paymentLine =
      body.paymentLine !== undefined
        ? body.paymentLine.trim()
        : current.paymentLine;
    const receiptPrefix =
      body.receiptPrefix !== undefined
        ? normalizeReceiptPrefix(body.receiptPrefix)
        : current.receiptPrefix;
    const parsedNext = Number(body.receiptNextNumber);
    const receiptNextNumber =
      body.receiptNextNumber !== undefined
        ? Number.isFinite(parsedNext) && parsedNext >= 1
          ? Math.floor(parsedNext)
          : current.receiptNextNumber
        : current.receiptNextNumber;

    await ensureReceiptSettingsTable();
    client = await pgPool.connect();

    const result = await client.query(
      `INSERT INTO receipt_settings
         (id, store_name, store_address, store_phones, logo_image,
          payment_title, payment_image, payment_line,
          receipt_prefix, receipt_next_number, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       ON CONFLICT (id) DO UPDATE SET
         store_name = EXCLUDED.store_name,
         store_address = EXCLUDED.store_address,
         store_phones = EXCLUDED.store_phones,
         logo_image = EXCLUDED.logo_image,
         payment_title = EXCLUDED.payment_title,
         payment_image = EXCLUDED.payment_image,
         payment_line = EXCLUDED.payment_line,
         receipt_prefix = EXCLUDED.receipt_prefix,
         receipt_next_number = EXCLUDED.receipt_next_number,
         updated_at = NOW()
       RETURNING store_name, store_address, store_phones, logo_image,
                 payment_title, payment_image, payment_line,
                 receipt_prefix, receipt_next_number`,
      [
        storeName,
        storeAddress,
        storePhones,
        logoImage,
        paymentTitle,
        paymentImage,
        paymentLine,
        receiptPrefix,
        receiptNextNumber,
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
