import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const gate = join(dirname(fileURLToPath(import.meta.url)), "../../deploy/git-gate.sh");
const gitEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "t@example.com",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "t@example.com",
  DEPLOY_PULL_ATTEMPTS: "1",
};

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, {
    cwd,
    env: gitEnv,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runGate(cwd: string): { code: number; stderr: string } {
  try {
    execSync(`bash ${JSON.stringify(gate)}`, {
      cwd,
      env: gitEnv,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stderr: "" };
  } catch (error) {
    const err = error as { status?: number; stderr?: Buffer | string };
    const stderr = typeof err.stderr === "string" ? err.stderr : err.stderr?.toString("utf8") ?? "";
    return { code: err.status ?? 1, stderr };
  }
}

function setup(): { root: string; origin: string; work: string } {
  const root = mkdtempSync(join(tmpdir(), "cv-gate-"));
  const origin = join(root, "origin");
  const work = join(root, "work");
  git(root, `init -b main ${JSON.stringify(origin)}`);
  writeFileSync(join(origin, "tsconfig.json"), "{}\n");
  writeFileSync(join(origin, "next-env.d.ts"), "/// <reference path=\"./.next/types/routes.d.ts\" />\n");
  writeFileSync(join(origin, "package.json"), "{\"version\":\"3.1.7\"}\n");
  writeFileSync(join(origin, "readme.txt"), "a\n");
  git(origin, "add tsconfig.json next-env.d.ts package.json readme.txt");
  git(origin, "commit -m init");
  git(root, `clone ${JSON.stringify(origin)} ${JSON.stringify(work)}`);
  return { root, origin, work };
}

test("грязный tsconfig не мешает pull: файл восстанавливается, HEAD становится origin/main", () => {
  const { root, origin, work } = setup();
  try {
    const before = git(work, "rev-parse HEAD");
    writeFileSync(join(origin, "tsconfig.json"), "{\"compilerOptions\":{}}\n");
    git(origin, "add tsconfig.json");
    git(origin, "commit -m remote");
    writeFileSync(join(work, "tsconfig.json"), "{\"dirty\":true}\n");
    const result = runGate(work);
    assert.equal(result.code, 0, result.stderr);
    const head = git(work, "rev-parse HEAD");
    const remote = git(work, "rev-parse origin/main");
    assert.equal(head, remote);
    assert.notEqual(head, before);
    assert.match(git(work, "status --porcelain"), /^$/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("чужая локальная правка блокирует pull: ненулевой код, HEAD не сдвигается", () => {
  const { root, origin, work } = setup();
  try {
    const before = git(work, "rev-parse HEAD");
    writeFileSync(join(origin, "readme.txt"), "remote\n");
    git(origin, "add readme.txt");
    git(origin, "commit -m remote");
    writeFileSync(join(work, "readme.txt"), "local\n");
    const result = runGate(work);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /сборка отменена/);
    assert.match(result.stderr, /не перезапускался/);
    assert.equal(git(work, "rev-parse HEAD"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("локальный коммит впереди origin/main не считается успешным обновлением", () => {
  const { root, work } = setup();
  try {
    writeFileSync(join(work, "readme.txt"), "ahead\n");
    git(work, "add readme.txt");
    git(work, "commit -m ahead");
    const result = runGate(work);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /не совпадает с origin\/main/);
    assert.match(result.stderr, /не трогали/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
