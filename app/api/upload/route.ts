import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Document upload now uses /api/documents/import so original files can be stored and converted safely.",
    },
    { status: 410 }
  );
}
