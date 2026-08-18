import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

function loadDatabaseUrl(): string {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    throw new Error("DATABASE_URL is not set and .env was not found");
  }

  const match = readFileSync(envPath, "utf8").match(/^DATABASE_URL=(.*)$/m);
  if (!match) {
    throw new Error("DATABASE_URL is missing in .env");
  }

  let value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value;
}

function parseMysqlUrl(url: string) {
  const parsed = new URL(url.replace(/^mysql:/, "http:"));
  const database = parsed.pathname.replace(/^\//, "").split("?")[0];
  if (!parsed.hostname || !database) {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

const migrationPath = join(process.cwd(), "deploy/migrate-weight-timezone.sql");
if (!existsSync(migrationPath)) {
  console.info("SQL migration file not found, skipping");
  process.exit(0);
}

const db = parseMysqlUrl(loadDatabaseUrl());
const sql = readFileSync(migrationPath, "utf8");

execFileSync("mysql", ["-h", db.host, "-P", db.port, "-u", db.user, db.database], {
  env: { ...process.env, MYSQL_PWD: db.password },
  input: sql,
  stdio: ["pipe", "inherit", "inherit"],
});

console.info("SQL migration applied");
