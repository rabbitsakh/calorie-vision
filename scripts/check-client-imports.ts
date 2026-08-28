/**
 * Fail if "use client" components import Node built-ins (node:dns, node:fs, …).
 * Prevents production build failures like node:dns bundled into the browser.
 *
 * Usage: npm run check:client-imports
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "..", "..");
const srcDir = join(root, "src");

/** Subpath imports that must not appear in client bundles. */
const FORBIDDEN_IMPORT_RE =
  /from\s+["'](node:[^"']+|@\/lib\/(?:prisma|auth-options|email-auth))["']/;

const CLIENT_MARKER = /^\s*["']use client["']\s*;?/m;

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      collectFiles(path, acc);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
      acc.push(path);
    }
  }
  return acc;
}

function main(): void {
  const violations: string[] = [];

  for (const file of collectFiles(srcDir)) {
    const text = readFileSync(file, "utf8");
    if (!CLIENT_MARKER.test(text)) continue;

    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("import ") && !trimmed.includes("from ")) continue;
      if (FORBIDDEN_IMPORT_RE.test(line)) {
        violations.push(`${relative(root, file)}: ${trimmed}`);
      }
    }
  }

  if (violations.length) {
    console.error("Client components must not import server-only modules:\n");
    for (const v of violations) console.error(`  ${v}`);
    console.error("\nMove shared code to a file without node: imports or remove \"use client\".");
    process.exit(1);
  }

  console.log("check-client-imports: ok");
}

main();
