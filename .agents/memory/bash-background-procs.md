---
name: Background processes die between bash calls
description: Why backgrounded servers/jobs started with & in one bash tool call are dead in the next, and how to test them.
---

Each `bash` tool invocation runs in its own short-lived shell. A process started
with `&` in one call is terminated when that call's shell exits, so a later
separate bash call sees it gone (curl returns `000`, empty log file).

**Why:** the tool does not keep a persistent background session; child processes
are reaped when the spawning shell ends.

**How to apply:**
- To exercise an ephemeral server (e.g. to test a feature flag that is OFF in the
  long-running workflow), start it, wait for readiness, run ALL curls, capture
  output to a file, and `kill` it — **all inside one bash command**.
- Never `pkill -f "tsx server/index.ts"` (or similar broad patterns): it also
  kills the platform "Start application" workflow. Use a distinct PORT and
  `kill $SRV` on the captured PID instead. If you do kill the workflow, restart
  it with `restart_workflow`.
- Use a unique PORT (e.g. 5050) so the ephemeral instance doesn't collide with
  the workflow on 5000.
