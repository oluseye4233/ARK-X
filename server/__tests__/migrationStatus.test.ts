import { test } from "node:test";
import assert from "node:assert/strict";
import { compareMigrationInventory } from "../migrationStatus";

test("migration inventory is current when every repository migration is applied", () => {
  assert.deepEqual(
    compareMigrationInventory(["0001.sql", "0002.sql"], ["0002.sql", "0001.sql"]),
    {
      ok: true,
      repositoryCount: 2,
      appliedCount: 2,
      firstMissingMigration: null,
    },
  );
});

test("migration inventory reports the first missing file in repository order", () => {
  assert.deepEqual(
    compareMigrationInventory(
      ["0001.sql", "0002.sql", "0003.sql"],
      ["0001.sql", "0003.sql"],
    ),
    {
      ok: false,
      repositoryCount: 3,
      appliedCount: 2,
      firstMissingMigration: "0002.sql",
    },
  );
});

test("extra historical tracking rows do not make the repository appear behind", () => {
  assert.deepEqual(
    compareMigrationInventory(["0002.sql"], ["0001-removed.sql", "0002.sql"]),
    {
      ok: true,
      repositoryCount: 1,
      appliedCount: 1,
      firstMissingMigration: null,
    },
  );
});