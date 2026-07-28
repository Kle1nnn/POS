import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_BYTES = 3 * 1024 * 1024; // 3MB

function uploadsDir() {
  return path.join(process.cwd(), "public", "uploads");
}

function isUploadPath(image: string) {
  return image.startsWith("uploads/");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPG, PNG, WEBP, or GIF images are allowed" },
        { status: 400 },
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "Image must be 3MB or smaller" },
        { status: 400 },
      );
    }

    const ext =
      file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : file.type === "image/gif"
            ? "gif"
            : "jpg";

    const filename = `${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
    const dir = uploadsDir();
    await mkdir(dir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const image = `uploads/${filename}`;
    return NextResponse.json({ image, url: `/${image}` }, { status: 201 });
  } catch (err) {
    console.error("Failed to upload image", err);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}

// DELETE /api/catalog/upload?image=uploads/xxx.jpg
export async function DELETE(req: NextRequest) {
  const image = req.nextUrl.searchParams.get("image")?.trim() ?? "";
  if (!image || !isUploadPath(image) || image.includes("..")) {
    return NextResponse.json({ error: "invalid image path" }, { status: 400 });
  }

  try {
    await unlink(path.join(process.cwd(), "public", image));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    // File may already be gone — treat as success
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
