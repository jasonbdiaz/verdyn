// Apply web/db/schema.sql to the Neon database in DATABASE_URL.
//   DATABASE_URL=... node web/scripts/migrate.mjs
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const sqlText = await readFile(join(here, "..", "db", "schema.sql"), "utf8");
const sql = neon(url);

// The neon HTTP driver is a tagged-template function only. Feed each raw DDL
// statement through a constructed TemplateStringsArray (no interpolation slots).
const rawSql = (text) => {
  const t = [text];
  t.raw = [text];
  return sql(t);
};

// Strip whole-line SQL comments first (otherwise a statement preceded by a
// comment block would be misread as a comment-only chunk and skipped), then
// split on semicolons at statement boundaries (schema has no function bodies).
const statements = sqlText
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

for (const stmt of statements) {
  await rawSql(stmt);
  console.log("ok:", stmt.split("\n")[0].slice(0, 70));
}
console.log(`\nApplied ${statements.length} statements.`);
