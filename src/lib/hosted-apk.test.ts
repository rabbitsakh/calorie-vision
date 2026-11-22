import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const repo = process.cwd();

function bash(script: string, env: NodeJS.ProcessEnv = {}): string {
  return execFileSync("bash", ["-c", script], {
    cwd: repo,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

test("publish_hosted_apk кладёт APK и манифест, не трогая версию приложения", () => {
  const root = mkdtempSync(join(tmpdir(), "cv-publish-apk-"));
  const dist = join(root, "dist");
  mkdirSync(dist);
  const apk = join(dist, "app-release.apk");
  writeFileSync(apk, "signed-apk");
  const pkgBefore = readFileSync(join(repo, "package.json"), "utf8");
  const twaBefore = readFileSync(join(repo, "rustore/twa-manifest.json"), "utf8");
  try {
    bash(
      `
      set -euo pipefail
      source "$REPO/scripts/lib/publish-hosted-apk.sh"
      publish_hosted_apk "$DEST" "$APK" --version-name 3.6.15 --version-code 30615 --built-at 2026-11-13T00:00:00.000Z
      `,
      { REPO: repo, DEST: root, APK: apk },
    );
    assert.equal(readFileSync(join(root, "public/downloads/calorie-vision.apk"), "utf8"), "signed-apk");
    const manifest = JSON.parse(readFileSync(join(root, "public/downloads/apk.json"), "utf8")) as {
      versionName: string;
      versionCode: number;
    };
    assert.equal(manifest.versionName, "3.6.15");
    assert.equal(manifest.versionCode, 30615);
    assert.equal(readFileSync(join(repo, "package.json"), "utf8"), pkgBefore);
    assert.equal(readFileSync(join(repo, "rustore/twa-manifest.json"), "utf8"), twaBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("publish_hosted_apk без версии не затирает уже лежащий файл", () => {
  const root = mkdtempSync(join(tmpdir(), "cv-publish-keep-"));
  const downloads = join(root, "public/downloads");
  mkdirSync(downloads, { recursive: true });
  writeFileSync(join(downloads, "calorie-vision.apk"), "old-apk");
  writeFileSync(join(downloads, "apk.json"), '{"versionName":"1.0.0"}\n');
  const fresh = join(root, "fresh.apk");
  writeFileSync(fresh, "new-apk");
  try {
    assert.throws(() => {
      bash(
        `
        set -euo pipefail
        source "$REPO/scripts/lib/publish-hosted-apk.sh"
        publish_hosted_apk "$DEST" "$APK" --repo "$EMPTY"
        `,
        { REPO: repo, DEST: root, APK: fresh, EMPTY: join(root, "empty") },
      );
    });
    assert.equal(readFileSync(join(downloads, "calorie-vision.apk"), "utf8"), "old-apk");
    assert.equal(readFileSync(join(downloads, "apk.json"), "utf8"), '{"versionName":"1.0.0"}\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("сборки Android публикуют APK вместе с манифестом", () => {
  for (const file of ["scripts/rustore-build.sh", "scripts/rustore-cap-build.sh"]) {
    const src = readFileSync(join(repo, file), "utf8");
    assert.match(src, /publish_hosted_apk/);
    assert.doesNotMatch(src, /cp -f "\$APK_OUT" "\$ROOT\/public\/downloads\/calorie-vision\.apk"/);
    assert.doesNotMatch(src, /cp -f "\$OUT_APK" "\$ROOT\/public\/downloads\/calorie-vision\.apk"/);
  }
  const publish = readFileSync(join(repo, "scripts/publish-apk-site.sh"), "utf8");
  assert.match(publish, /apk\.json/);
});

test("APK и манифест не попадают в git, .gitkeep остаётся", () => {
  const apk = join(repo, "public/downloads/calorie-vision.apk");
  const json = join(repo, "public/downloads/apk.json");
  writeFileSync(apk, "not-a-real-apk");
  writeFileSync(json, "{}\n");
  try {
    const ignoredApk = execFileSync("git", ["check-ignore", "-q", "--", "public/downloads/calorie-vision.apk"], {
      cwd: repo,
    });
    assert.equal(ignoredApk.status ?? 0, 0);
    execFileSync("git", ["check-ignore", "-q", "--", "public/downloads/apk.json"], { cwd: repo });
    assert.throws(() => {
      execFileSync("git", ["check-ignore", "-q", "--", "public/downloads/.gitkeep"], { cwd: repo });
    });
    const status = execFileSync("git", ["status", "--porcelain", "--", "public/downloads"], {
      cwd: repo,
      encoding: "utf8",
    });
    assert.equal(status.trim(), "");
  } finally {
    rmSync(apk, { force: true });
    rmSync(json, { force: true });
  }
});

test("cv-release сохраняет APK, если pull его стирает, и не затирает новый", () => {
  const app = mkdtempSync(join(tmpdir(), "cv-hosted-"));
  const downloads = join(app, "public/downloads");
  mkdirSync(downloads, { recursive: true });
  writeFileSync(join(downloads, "calorie-vision.apk"), "kept-apk");
  writeFileSync(join(downloads, "apk.json"), '{"versionName":"3.6.15"}\n');
  const script = join(repo, "deploy/hosted-apk.sh");
  try {
    bash(
      `
      set -euo pipefail
      ensure_ff_origin_main() { rm -f "$APP/public/downloads/calorie-vision.apk" "$APP/public/downloads/apk.json"; return 0; }
      source "$SCRIPT"
      pull_origin_keeping_hosted_apk "$APP"
      rm -rf "\${CV_HOSTED_APK_SNAPSHOT:-}"
      `,
      { APP: app, SCRIPT: script },
    );
    assert.equal(readFileSync(join(downloads, "calorie-vision.apk"), "utf8"), "kept-apk");
    assert.equal(readFileSync(join(downloads, "apk.json"), "utf8"), '{"versionName":"3.6.15"}\n');

    bash(
      `
      set -euo pipefail
      ensure_ff_origin_main() { printf '%s' replaced-during-pull > "$APP/public/downloads/calorie-vision.apk"; return 0; }
      source "$SCRIPT"
      pull_origin_keeping_hosted_apk "$APP"
      rm -rf "\${CV_HOSTED_APK_SNAPSHOT:-}"
      `,
      { APP: app, SCRIPT: script },
    );
    assert.equal(readFileSync(join(downloads, "calorie-vision.apk"), "utf8"), "replaced-during-pull");
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test("неудачный pull тоже возвращает APK и отдаёт ненулевой код", () => {
  const app = mkdtempSync(join(tmpdir(), "cv-hosted-fail-"));
  const downloads = join(app, "public/downloads");
  mkdirSync(downloads, { recursive: true });
  writeFileSync(join(downloads, "calorie-vision.apk"), "kept-apk");
  const script = join(repo, "deploy/hosted-apk.sh");
  try {
    const result = execFileSync(
      "bash",
      [
        "-c",
        `
        set -euo pipefail
        ensure_ff_origin_main() { rm -f "$APP/public/downloads/calorie-vision.apk"; return 1; }
        source "$SCRIPT"
        if pull_origin_keeping_hosted_apk "$APP"; then
          exit 0
        fi
        exit 7
        `,
      ],
      {
        cwd: repo,
        env: { ...process.env, APP: app, SCRIPT: script },
        encoding: "utf8",
      },
    );
    assert.fail(`ожидали ненулевой код, stdout=${result}`);
  } catch (error) {
    const err = error as { status?: number };
    assert.equal(err.status, 7);
    assert.equal(readFileSync(join(downloads, "calorie-vision.apk"), "utf8"), "kept-apk");
    assert.equal(existsSync(join(downloads, "apk.json")), false);
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test("cv-release и deploy оборачивают git pull сохранением APK", () => {
  const deploy = readFileSync(join(repo, "deploy/deploy.sh"), "utf8");
  const release = readFileSync(join(repo, "deploy/release.sh"), "utf8");
  assert.match(deploy, /pull_origin_keeping_hosted_apk/);
  assert.match(release, /pull_origin_keeping_hosted_apk/);
  assert.equal(deploy.includes("ensure_ff_origin_main"), false);
});
