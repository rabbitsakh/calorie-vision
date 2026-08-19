import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION_BASE } from "./app-version";

export function readPackageVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      version?: string;
    };
    if (packageJson.version && /^\d+\.\d+\.\d+$/.test(packageJson.version)) {
      return packageJson.version;
    }
  } catch {
    // package.json unavailable during some tooling runs
  }
  return APP_VERSION_BASE;
}
