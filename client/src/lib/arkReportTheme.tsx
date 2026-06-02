/* Shared ATANDA brand theme primitives for the export-ready ARK documents
   (the ARK Report sheet and the Career Adviser Guide). Kept in one place so
   both documents render with identical palette + bar styling and so neither
   page has to import presentation helpers from the other (avoids a cycle). */

/* ATANDA brand palette (explicit hex for html2canvas export fidelity). */
export const ATANDA = {
  ink: "#0B1B33",
  sub: "#5B6B82",
  line: "#E4E8EF",
  panel: "#F6F8FB",
  blue: "#1B6FB5",
  yellow: "#F2C230",
  red: "#E2231A",
  teal: "#00A3C4",
  green: "#2BB673",
  purple: "#8E44AD",
  orange: "#FF6B4A",
};

export const BRAND_BAR = `linear-gradient(90deg, ${ATANDA.yellow} 0%, ${ATANDA.orange} 20%, ${ATANDA.red} 40%, ${ATANDA.teal} 60%, ${ATANDA.green} 80%, ${ATANDA.purple} 100%)`;

export function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: 8, background: ATANDA.line, borderRadius: 999, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}
