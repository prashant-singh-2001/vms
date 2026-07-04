import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "./client";

export async function runMigrations(): Promise<void> {
  const file = path.join(import.meta.dir, "init.sql");
  const ddl = readFileSync(file, "utf-8");

  const attempts = 20;
  for (let i = 1; i <= attempts; i++) {
    try {
      await sql.unsafe(ddl);
      console.log("[db] schema ready");
      return;
    } catch (err) {
      if (i === attempts) throw err;
      console.log(`[db] not ready yet (attempt ${i}/${attempts}), retrying in 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
