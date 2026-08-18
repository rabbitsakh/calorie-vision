import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseMysqlUrl, readEnvFileValue } from "../src/lib/mysql-url.ts";

function getDatabaseUrl(): string {
  const envPath = join(process.cwd(), ".env");
  if (existsSync(envPath)) {
    const fromFile = readEnvFileValue(readFileSync(envPath, "utf8"), "DATABASE_URL");
    if (fromFile?.trim()) {
      return fromFile.trim();
    }
  }

  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  throw new Error("DATABASE_URL is missing in .env");
}

function quoteIni(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function runMysqlMigration(db: ReturnType<typeof parseMysqlUrl>, sql: string): void {
  const configPath = join(process.cwd(), `.mysql-client-${randomBytes(8).toString("hex")}.cnf`);
  const ini = [
    "[client]",
    `user=${quoteIni(db.user)}`,
    `password=${quoteIni(db.password)}`,
    `host=${quoteIni(db.host)}`,
    `port=${db.port}`,
    "protocol=tcp",
    "",
  ].join("\n");

  writeFileSync(configPath, ini, { mode: 0o600 });

  const env = { ...process.env };
  delete env.MYSQL_PWD;
  delete env.MYSQL_HOST;
  delete env.MYSQL_TCP_PORT;
  delete env.MYSQL_UNIX_PORT;

  try {
    // --defaults-file is first so ~/.my.cnf (often root@localhost) is ignored.
    execFileSync("mysql", [`--defaults-file=${configPath}`, "--database", db.database], {
      env,
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    });
  } finally {
    unlinkSync(configPath);
  }
}

function main(): void {
  const deployDir = join(process.cwd(), "deploy");
  const files = existsSync(deployDir)
    ? readdirSync(deployDir)
        .filter((name) => name.startsWith("migrate-") && name.endsWith(".sql"))
        .sort()
    : [];

  if (files.length === 0) {
    console.info("SQL migration files not found, skipping");
    return;
  }

  const db = parseMysqlUrl(getDatabaseUrl());
  console.info(`MySQL: ${db.user}@${db.host}:${db.port}/${db.database}`);

  try {
    for (const file of files) {
      const sql = readFileSync(join(deployDir, file), "utf8");
      runMysqlMigration(db, sql);
      console.info(`SQL migration applied: ${file}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SQL migration failed:", message);
    console.error(
      "Проверьте DATABASE_URL в .env приложения. Клиент mysql не должен брать root из ~/.my.cnf.",
    );
    process.exit(1);
  }
}

main();
