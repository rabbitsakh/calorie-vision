import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function loadEnvFile(): void {
  const envPath = join(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function getDatabaseUrl(): string {
  loadEnvFile();
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is missing in .env");
  }
  return url;
}

function parseMysqlUrl(url: string) {
  const normalized = url.replace(/^mysql:\/\//, "");
  const slash = normalized.indexOf("/");
  if (slash === -1) {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  const authority = normalized.slice(0, slash);
  const database = normalized.slice(slash + 1).split("?")[0];
  const at = authority.lastIndexOf("@");
  if (at === -1) {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  const userInfo = authority.slice(0, at);
  const hostPort = authority.slice(at + 1);
  const colon = userInfo.indexOf(":");
  const user = decodeURIComponent(colon >= 0 ? userInfo.slice(0, colon) : userInfo);
  const password = decodeURIComponent(colon >= 0 ? userInfo.slice(colon + 1) : "");

  const portMatch = hostPort.match(/:(\d+)$/);
  const host = portMatch ? hostPort.slice(0, -(portMatch[0].length)) : hostPort;
  const port = portMatch ? portMatch[1] : "3306";

  if (!host || !database) {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  return {
    host,
    port,
    user,
    password,
    database,
  };
}

function escapeIniValue(value: string): string {
  if (/[\s"'#;\\]/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

function runMysqlMigration(
  db: ReturnType<typeof parseMysqlUrl>,
  sql: string,
): void {
  const configPath = join(tmpdir(), `cv-mysql-${randomBytes(8).toString("hex")}.cnf`);
  const ini = [
    "[client]",
    `user=${escapeIniValue(db.user)}`,
    `password=${escapeIniValue(db.password)}`,
    `host=${escapeIniValue(db.host)}`,
    `port=${db.port}`,
    "",
  ].join("\n");

  writeFileSync(configPath, ini, { mode: 0o600 });

  try {
    execFileSync("mysql", [`--defaults-extra-file=${configPath}`, db.database], {
      input: sql,
      stdio: ["pipe", "inherit", "inherit"],
    });
  } finally {
    unlinkSync(configPath);
  }
}

function main(): void {
  const migrationPath = join(process.cwd(), "deploy/migrate-weight-timezone.sql");
  if (!existsSync(migrationPath)) {
    console.info("SQL migration file not found, skipping");
    return;
  }

  const db = parseMysqlUrl(getDatabaseUrl());
  const sql = readFileSync(migrationPath, "utf8");

  try {
    runMysqlMigration(db, sql);
    console.info("SQL migration applied");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("SQL migration failed:", message);
    console.error(
      "Проверьте DATABASE_URL в .env: пользователь, пароль и имя базы должны совпадать с MySQL.",
    );
    console.error(
      "Если Prisma (db:push) подключается, а mysql CLI — нет, попробуйте host 127.0.0.1 вместо localhost.",
    );
    process.exit(1);
  }
}

main();
