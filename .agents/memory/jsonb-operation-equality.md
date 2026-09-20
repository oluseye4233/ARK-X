---
name: JSONB operation equality
description: How to compare persisted idempotency payloads after a PostgreSQL JSONB round trip.
---

Compare JSONB-backed operation payloads with semantic deep equality, not serialized string equality.

**Why:** PostgreSQL can normalize object key order when storing JSONB. Two identical requests can therefore stringify differently after one payload has made a database round trip, causing a retry to be mistaken for a new operation.

**How to apply:** Whenever request idempotency or replay detection compares a live object with a JSONB payload, use an order-insensitive deep comparison while preserving normal array ordering and value types.