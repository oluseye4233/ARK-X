// M5 — Matrix Forge Lab: safely parse a user-uploaded .docx into plain text
// for the HIVE pre-check. Hard limits enforced here instead of trusting the
// route layer because mammoth is the only consumer.
import mammoth from "mammoth";

export const FORGE_LAB_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const FORGE_LAB_PARSE_TIMEOUT_MS = 8000;
export const FORGE_LAB_MAX_OUTPUT_CHARS = 50_000;

const DOCX_MIMETYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export class ForgeLabParseError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isAllowedDocxMimetype(mimetype: string): boolean {
  return DOCX_MIMETYPES.has(mimetype);
}

// A .docx is a zip; macro-enabled (.docm) or VBA-embedded docs include a
// `vbaProject.bin` entry. We refuse any upload whose raw bytes contain that
// filename anywhere — a cheap, dependency-free macro reject that runs before
// mammoth touches the buffer.
export function containsVbaMacro(buf: Buffer): boolean {
  // ZIP central-directory filename entries are stored as plain ASCII.
  // Slice scan to avoid quadratic search on very large inputs.
  const needle = Buffer.from("vbaProject.bin", "utf-8");
  return buf.includes(needle);
}

export async function parseDocxBuffer(buf: Buffer): Promise<string> {
  if (buf.length > FORGE_LAB_MAX_BYTES) {
    throw new ForgeLabParseError(
      `File too large (${Math.round(buf.length / 1024)}KB). Max ${FORGE_LAB_MAX_BYTES / 1024 / 1024}MB.`,
      413,
    );
  }
  if (containsVbaMacro(buf)) {
    throw new ForgeLabParseError(
      "Macro-enabled documents (.docm / VBA) are not permitted.",
      400,
    );
  }
  const work = mammoth
    .extractRawText({ buffer: buf })
    .then((r) => r.value || "");
  const text = await Promise.race<string>([
    work,
    new Promise<string>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new ForgeLabParseError("Document parse timed out — file too complex.", 408),
          ),
        FORGE_LAB_PARSE_TIMEOUT_MS,
      ),
    ),
  ]);
  // Clamp downstream cost: marketplace body is capped at 50k chars anyway.
  return text.slice(0, FORGE_LAB_MAX_OUTPUT_CHARS);
}
