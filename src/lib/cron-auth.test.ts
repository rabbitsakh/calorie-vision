import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { authorizeCron } from "./cron-auth.ts";

function req(auth: string | null) {
  const headers = new Headers();
  if (auth) headers.set("authorization", auth);
  return new NextRequest("http://localhost/api/cron/reminders", { headers });
}

test("authorizeCron denies when CRON_SECRET is missing", () => {
  const prev = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    assert.equal(authorizeCron(req("Bearer anything")), false);
    assert.equal(authorizeCron(req(null)), false);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test("authorizeCron requires exact Bearer secret", () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";
  try {
    assert.equal(authorizeCron(req(null)), false);
    assert.equal(authorizeCron(req("Bearer wrong")), false);
    assert.equal(authorizeCron(req("Bearer test-cron-secret")), true);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});
