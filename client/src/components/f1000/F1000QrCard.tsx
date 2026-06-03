import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download } from "lucide-react";

interface F1000QrCardProps {
  /** Destination the QR encodes (the /f1000 claim page). */
  url: string;
  /** Rendered pixel size of the QR image. */
  size?: number;
  /** Show a "Download PNG" button (for printing into the book). */
  showDownload?: boolean;
  caption?: string;
}

/**
 * Renders a high-contrast QR code (dark modules on white) pointing at the
 * F1000 claim page. Dark-on-white is deliberate — it scans far more reliably
 * than themed low-contrast variants. Optionally offers a PNG download so the
 * same code can be dropped into the printed book.
 */
export function F1000QrCard({ url, size = 180, showDownload = false, caption }: F1000QrCardProps) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0f1aff", light: "#ffffffff" },
    })
      .then((d) => {
        if (active) setDataUrl(d);
      })
      .catch(() => {
        if (active) setDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-3" data-testid="f1000-qr-card">
      <div
        className="rounded-xl bg-white p-3 shadow-[0_0_30px_hsl(var(--primary)/0.35)] ring-1 ring-primary/40"
        style={{ width: size + 24, height: size + 24 }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="QR code to claim your F1000 invite"
            width={size}
            height={size}
            data-testid="img-f1000-qr"
            className="block"
          />
        ) : (
          <div
            className="animate-pulse rounded bg-muted"
            style={{ width: size, height: size }}
          />
        )}
      </div>
      {caption && (
        <p className="text-center text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {caption}
        </p>
      )}
      {showDownload && dataUrl && (
        <a
          href={dataUrl}
          download="ark-f1000-qr.png"
          data-testid="link-download-f1000-qr"
          className="inline-flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
        >
          <Download className="h-4 w-4" /> Download QR (for print)
        </a>
      )}
    </div>
  );
}
