import { readFileSync } from "fs";
import path from "path";

// The craft reference Wright loads into every AI request so suggestions stay
// sharp and voice-preserving. Cached after the first read (nodejs runtime).
let cached: string | null = null;

export function getWritingGuide(): string {
  if (cached !== null) return cached;
  try {
    const file = path.join(process.cwd(), "lib", "writing-guide.md");
    cached = readFileSync(file, "utf8");
  } catch {
    // If the guide can't be read, degrade gracefully rather than failing the request.
    cached = "";
  }
  return cached;
}
