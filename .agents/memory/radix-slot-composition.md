---
name: Radix double asChild/Slot composition swallows clicks
description: Nesting two Radix primitives via asChild (e.g. TooltipTrigger asChild > TabsTrigger) can silently drop the inner control's click handler under React 19.
---

Do NOT nest two interactive Radix primitives through `asChild` such that one Slot
wraps another's real control — e.g. `<TooltipTrigger asChild><TabsTrigger>…</TabsTrigger></TooltipTrigger>`.
Under React 19 + Radix, the Slot-on-Slot prop/ref merge can silently swallow the
inner primitive's own behavior (here: `TabsTrigger`'s click-to-activate), so the
component renders and even shows its tooltip but does nothing on click.

**Why:** React 19 changed ref handling; Radix `Slot` composition that merges two
event-handler/ref sets does not reliably chain the inner primitive's intrinsic
handler. The failure is invisible — no console error, no type error — the control
just goes inert.

**How to apply:** Keep the primitive that owns the core interaction (Tabs/Accordion/Dialog
trigger, etc.) as the OUTER real element, and put the decorative wrapper INSIDE it.
Pattern that works:
`<TabsTrigger value=…><Tooltip><TooltipTrigger asChild><span>Label</span></TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip></TabsTrigger>`.
When a Radix control "renders fine but clicking does nothing," suspect an `asChild`
wrapper above it before anything else.
