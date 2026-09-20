const deploymentUrl = process.argv[2];

if (!deploymentUrl) {
  console.error("Usage: npm run check:published-migrations -- https://your-app.replit.app");
  process.exit(2);
}

const endpoint = new URL("/api/health/migrations", deploymentUrl);

try {
  const response = await fetch(endpoint, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json() as {
    ok?: boolean;
    repositoryCount?: number;
    appliedCount?: number;
    firstMissingMigration?: string | null;
    startupLog?: string;
  };

  if (!response.ok || !body.ok) {
    console.error(
      `[migration-check] live schema is behind; first missing migration: ` +
        `${body.firstMissingMigration ?? "unknown"}`,
    );
    console.error(`[migration-check] deployment startup log: ${body.startupLog ?? "unavailable"}`);
    process.exit(1);
  }

  console.log(
    `[migration-check] production is current ` +
      `(${body.appliedCount}/${body.repositoryCount} repository migrations applied)`,
  );
  console.log(`[migration-check] deployment startup log: ${body.startupLog}`);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`[migration-check] could not check the published app: ${detail}`);
  process.exit(1);
}