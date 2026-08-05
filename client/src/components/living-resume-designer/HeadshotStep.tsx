import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface Props {
  headshotDataUrl: string | null;
  headshotAlt: string;
  onChange: (dataUrl: string | null) => void;
  onAltChange: (alt: string) => void;
}

// Client-side downscale to <=400px square + JPEG compress before it's
// embedded (LRD-106). Reuses the same server field/endpoint as ARK Resume
// (users.headshotDataUrl via /api/ark-resume/headshot) — the Designer and
// ARK Resume share one headshot, not two.
async function downscaleToSquare(file: File, maxSize = 400): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not decode image."));
    el.src = dataUrl;
  });
  const side = Math.min(img.width, img.height);
  const sx = (img.width - side) / 2;
  const sy = (img.height - side) / 2;
  const outSide = Math.min(maxSize, side);
  const canvas = document.createElement("canvas");
  canvas.width = outSide;
  canvas.height = outSide;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, outSide, outSide);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function HeadshotStep({ headshotDataUrl, headshotAlt, onChange, onAltChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const dataUrl = await downscaleToSquare(file);
      const res = await api.setArkResumeHeadshot(dataUrl);
      onChange(res.headshotDataUrl ?? dataUrl);
    } catch (err: any) {
      setError(err.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteArkResumeHeadshot();
      onChange(null);
    } catch (err: any) {
      setError(err.message ?? "Could not remove photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3" data-testid="headshot-step">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full overflow-hidden border border-white/15 bg-white/5 flex items-center justify-center shrink-0">
          {headshotDataUrl ? (
            <img src={headshotDataUrl} alt="Headshot" className="w-full h-full object-cover" />
          ) : (
            <Upload className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFile}
            data-testid="input-lrd-headshot"
          />
          <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()} data-testid="button-lrd-upload-headshot">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
            {headshotDataUrl ? "Replace" : "Upload"}
          </Button>
          {headshotDataUrl && (
            <Button variant="outline" size="sm" disabled={busy} onClick={handleRemove} data-testid="button-lrd-remove-headshot">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      {headshotDataUrl && (
        <div>
          <Label htmlFor="lrd-headshot-alt">Alt text (required before export)</Label>
          <Input
            id="lrd-headshot-alt"
            data-testid="input-headshot-alt"
            value={headshotAlt}
            onChange={(e) => onAltChange(e.target.value)}
            placeholder="Headshot of [name], [context]"
          />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
