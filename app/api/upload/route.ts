import { NextRequest, NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json(
        { error: "Please upload a .docx file" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await mammoth.convertToHtml({ buffer });

    return NextResponse.json({
      html: result.value,
      messages: result.messages,
      filename: file.name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to parse file";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
