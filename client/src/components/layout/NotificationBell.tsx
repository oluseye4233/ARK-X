import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/useAuth";
import { api } from "@/lib/api";
import { useNotificationStream, type ArkNotification, type ArkRoundtableEvent } from "@/lib/useArkStream";
import { cn } from "@/lib/utils";

function formatRelative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  "roundtable.seat_rotation": { label: "ROUNDTABLE", color: "text-purple-400" },
  "synergy.discovered":       { label: "SYNERGY",    color: "text-emerald-400" },
  "synthesis.completed":      { label: "SYNTHESIS",  color: "text-cyan-400" },
  "spc.first_sale":           { label: "FIRST SALE", color: "text-amber-400" },
  "spc.purchased":            { label: "SALE",       color: "text-amber-400" },
};

export function NotificationBell() {
  const { user } = useAuth();
  const enabled = !!user?.id;
  const [items, setItems] = useState<ArkNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  // Initial fetch on mount.
  useEffect(() => {
    if (!enabled) return;
    api.getNotifications()
      .then((r: { items: ArkNotification[]; unread: number }) => {
        setItems(r.items || []);
        setUnread(r.unread || 0);
      })
      .catch(() => null);
  }, [enabled]);

  // Live stream: prepend new notifications, bump unread counter.
  const onNotif = useCallback((n: ArkNotification) => {
    setItems((prev) => [n, ...prev].slice(0, 25));
    setUnread((u) => u + 1);
  }, []);
  // Roundtable seat rotation — toast badge (no persistent inbox row).
  const onSeat = useCallback((_e: ArkRoundtableEvent) => {
    // The server already persists per-user notifications for affected creators
    // (debounced). For everyone else this is a pure ambient signal — no UI
    // state to update here, but keeping the subscription open guarantees the
    // bell stays warm if we want to add a global toast later.
  }, []);
  useNotificationStream(enabled, onNotif, onSeat);

  const markAllRead = async () => {
    if (unread === 0) return;
    try {
      await api.markNotificationsRead();
      setUnread(0);
      setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date().toISOString() })));
    } catch {}
  };

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="button-notification-bell"
        aria-label="Notifications"
        className={cn(
          "relative p-2 rounded-md border border-white/10 hover:border-primary/40 hover:bg-primary/5 transition-colors",
          unread > 0 ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span
            data-testid="text-notification-unread"
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-mono font-bold flex items-center justify-center"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="panel-notifications"
          className="absolute right-0 top-full mt-2 w-[320px] max-h-[420px] overflow-y-auto rounded-lg border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl z-50"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Inbox
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={markAllRead}
                data-testid="button-mark-all-read"
                className="text-[10px] font-mono uppercase text-primary hover:text-primary/70"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
              No notifications yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((n) => {
                const badge = TYPE_BADGE[n.type] ?? { label: n.type, color: "text-muted-foreground" };
                const isUnread = !n.readAt;
                // Mark this single item read on click; close the dropdown only
                // when the notification carries a link (navigation handles the
                // close transition naturally otherwise).
                const handleClick = () => {
                  if (isUnread) {
                    api.markNotificationsRead([n.id]).catch(() => null);
                    setItems((prev) => prev.map((it) => it.id === n.id ? { ...it, readAt: new Date().toISOString() } : it));
                    setUnread((u) => Math.max(0, u - 1));
                  }
                  if (n.link) setOpen(false);
                };
                const body = (
                  <div
                    className={cn(
                      "px-3 py-2.5 hover:bg-white/5 transition-colors block cursor-pointer",
                      isUnread && "bg-primary/5",
                    )}
                    data-testid={`row-notification-${n.id}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={cn("text-[9px] font-mono uppercase tracking-widest", badge.color)}>
                        {badge.label}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {formatRelative(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-foreground leading-snug">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{n.body}</p>}
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={handleClick}>{body}</Link>
                    ) : (
                      <button type="button" onClick={handleClick} className="w-full text-left">{body}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
