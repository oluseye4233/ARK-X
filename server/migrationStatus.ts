export type MigrationStatus = {
  ok: boolean;
  repositoryCount: number;
  appliedCount: number;
  firstMissingMigration: string | null;
};

export function compareMigrationInventory(
  repositoryFiles: readonly string[],
  appliedFiles: readonly string[],
): MigrationStatus {
  const applied = new Set(appliedFiles);
  const firstMissingMigration =
    repositoryFiles.find((filename) => !applied.has(filename)) ?? null;

  return {
    ok: firstMissingMigration === null,
    repositoryCount: repositoryFiles.length,
    appliedCount: repositoryFiles.filter((filename) => applied.has(filename)).length,
    firstMissingMigration,
  };
}