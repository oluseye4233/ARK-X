---
name: pdf-parse v2 API
description: The v2.x package exposes a class, not a default-export function — old call sites silently fail.
---

**Rule:** `pdf-parse@2.x` ships a named export `PDFParse` (a class). Use it as:

```ts
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { PDFParse } = _require("pdf-parse");
const parser = new PDFParse({ data: new Uint8Array(buf) });
const { text } = await parser.getText();
```

The v1 default-export style `import pdfParse from "pdf-parse"; pdfParse(buf)` does **not** work — `pdfParse` is undefined and the call throws.

**Why:** v1 → v2 was a breaking API rewrite. Old snippets and most LLM-generated examples still use the v1 form and fail silently in a try/catch that swallows undefined-callable errors.

**How to apply:** When parsing PDFs in a Node script, always check `package.json` for the pdf-parse major. v2+ → use `PDFParse` class. The `data` field must be a `Uint8Array` (not a Node Buffer directly, even though they're compatible — be explicit).
