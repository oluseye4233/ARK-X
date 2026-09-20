---
name: Action error dismissal
description: UI rule for clearing retryable action errors before a new request runs.
---

Retryable action errors must disappear immediately when the user starts another attempt. Do not place these errors inside an exit-animation boundary that keeps removed children mounted.

**Why:** A fast successful retry can otherwise render its confirmation while the previous failure copy remains visible, producing contradictory feedback.

**How to apply:** For actions that clear an error before retrying, render the error outside presence/exit animation wrappers or otherwise ensure stale text is removed synchronously.