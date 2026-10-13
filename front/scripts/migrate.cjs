require("dotenv/config");
const { Client } = require("pg");
const { readdirSync, readFileSync } = require("node:fs");
const { createHash, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");

// Only a completely empty public schema needs the historical dependency repair.
// Existing installations keep their migration files, names and checksums unchanged.
async function initializeEmptyDatabase() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('apart-migration-bootstrap'))",
    );
    const objects = await client.query(
      "SELECT 1 FROM pg_class WHERE relnamespace = 'public'::regnamespace UNION ALL SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace LIMIT 1",
    );
    if (!objects.rowCount) {
      const names = readdirSync("prisma/migrations", { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      const notice = "202610100002_notice_period";
      names.splice(names.indexOf(notice), 1);
      names.splice(
        names.indexOf("20261010100000_schedule_type") + 1,
        0,
        notice,
      );
      await client.query(`CREATE TABLE "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY, "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ, "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT, "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);
      for (const name of names) {
        const sql = readFileSync(`prisma/migrations/${name}/migration.sql`);
        await client.query(sql.toString());
        await client.query(
          'INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count) VALUES ($1,$2,$3,now(),1)',
          [randomUUID(), createHash("sha256").update(sql).digest("hex"), name],
        );
      }
      console.log(
        "Initialized empty database with verified historical migration order.",
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
initializeEmptyDatabase()
  .then(() => {
    const result = spawnSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "migrate", "deploy"],
      { stdio: "inherit", windowsHide: true },
    );
    process.exitCode = result.status ?? 1;
  })
  .catch(() => {
    console.error(
      "Database migration failed. Existing data was not reset; check connectivity and migration history.",
    );
    process.exitCode = 1;
  });
