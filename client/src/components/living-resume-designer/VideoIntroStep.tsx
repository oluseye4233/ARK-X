import { useState } from "react";
import { Loader2, PlayCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import UpgradeGate from "@/components/UpgradeGate";
import type { VideoIntroDraft } from "./types";

interface Props {
  video: VideoIntroDraft | null;
  onChange: (video: VideoIntroDraft | null) => void;
  hasAccess: boolean;
}

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

function extractVideoId(url: string): string | null {
  const m = url.match(YOUTUBE_RE);
  return m ? m[1] : null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read thumbnail."));
    reader.readAsDataURL(blob);
  });
}

// LRD-107 / disclosed exception (PDD §1 Step 5b): the thumbnail is fetched
// ONCE, while the subscriber is online editing, and embedded as base64 so the
// exported file needs no network call to show it. Only the real YouTube
// embed — loaded on viewer click, inside the exported file — is a network
// call, and it's disclosed on the card ("External video — hosted on YouTube").
export function VideoIntroStep({ video, onChange, hasAccess }: Props) {
  const [input, setInput] = useState(video?.url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    const videoId = extractVideoId(input.trim());
    if (!videoId) {
      setError("That doesn't look like a valid YouTube URL.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      if (!res.ok) throw new Error("Thumbnail fetch failed.");
      const dataUrl = await blobToDataUrl(await res.blob());
      onChange({ url: input.trim(), videoId, thumbnailDataUrl: dataUrl });
    } catch {
      // Thumbnail embed can fail (e.g. CORS) without blocking the video
      // link itself — the Honesty Gate will flag the missing thumbnail so
      // it's surfaced, never silently dropped.
      onChange({ url: input.trim(), videoId, thumbnailDataUrl: null });
      setError("Added the link, but couldn't embed an offline thumbnail — it'll show a generic play card instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <UpgradeGate hasAccess={hasAccess} requiredPlan="Pro" featureName="Video Introduction">
      <div className="space-y-3" data-testid="video-intro-step">
        {video ? (
          <div className="flex items-center gap-3">
            <div className="w-28 h-16 rounded overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
              {video.thumbnailDataUrl ? (
                <img src={video.thumbnailDataUrl} alt="Video thumbnail" className="w-full h-full object-cover" />
              ) : (
                <PlayCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs font-mono text-muted-foreground truncate flex-1">{video.url}</p>
            <Button variant="outline" size="sm" onClick={() => { onChange(null); setInput(""); }} data-testid="button-remove-video">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Label htmlFor="lrd-video-url">YouTube URL</Label>
            <div className="flex gap-2">
              <Input
                id="lrd-video-url"
                data-testid="input-video-url"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
              />
              <Button onClick={handleAdd} disabled={busy} data-testid="button-add-video">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </div>
          </>
        )}
        {error && <p className="text-xs text-amber-400">{error}</p>}
      </div>
    </UpgradeGate>
  );
}
