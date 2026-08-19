import { readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_VERSION_FALLBACK = "0.4.0";

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
  return PACKAGE_VERSION_FALLBACK;
}
