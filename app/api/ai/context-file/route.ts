import { NextRequest, NextResponse } from "next/server";
import {
  extractChatFileText,
  validateChatContextFile,
} from "@/lib/ai/chatFileContext";
import { ImportValidationError } from "@/lib/import/validateFile";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ImportValidationError("No file was uploaded.", "missing_file");
    }

    const type = validateChatContextFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const extracted = await extractChatFileText(type, {
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      buffer,
    });

    return NextResponse.json({
      name: file.name,
      text: extracted.text,
      truncated: extracted.truncated,
    });
  } catch (err) {
    if (err instanceof ImportValidationError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 400 }
      );
    }

    console.error("Chat context file parse failed", err);
    const message =
      err instanceof Error
        ? err.message
        : "We couldn't read that file. Try a .docx, .txt, or .md file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
