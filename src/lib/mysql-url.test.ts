import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMysqlUrl, readEnvFileValue } from "./mysql-url.ts";

test("parses a Prisma mysql URL with 127.0.0.1", () => {
  const parsed = parseMysqlUrl("mysql://calorie:secret@127.0.0.1:3306/calorie_vision");
  assert.deepEqual(parsed, {
    host: "127.0.0.1",
    port: "3306",
    user: "calorie",
    password: "secret",
    database: "calorie_vision",
  });
});

test("reads DATABASE_URL from a quoted .env file and ignores BOM", () => {
  const env = `\uFEFFDATABASE_URL="mysql://calorie:p%40ss@127.0.0.1:3306/calorie_vision"\n`;
  const url = readEnvFileValue(env, "DATABASE_URL");
  assert.equal(url, "mysql://calorie:p%40ss@127.0.0.1:3306/calorie_vision");
  assert.equal(parseMysqlUrl(url!).password, "p@ss");
});
