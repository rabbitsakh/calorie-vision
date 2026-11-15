import assert from "node:assert/strict";
import { test } from "node:test";
import { saveMealOnce } from "./meal-idempotency.ts";
import {
  clientRequestIdsOf,
  newClientRequestId,
  normalizeClientRequestId,
  withClientRequestId,
  withClientRequestIdsOnBody,
} from "./meal-request-id.ts";

type Row = { id: string; dishName: string; clientRequestId: string | null };

test("повтор с ключом возвращает ту же запись и не создаёт вторую", async () => {
  const rows: Row[] = [];
  let creates = 0;
  const save = (clientRequestId: string, dishName: string) =>
    saveMealOnce<Row>({
      clientRequestId,
      findExisting: async (key) => rows.find((row) => row.clientRequestId === key) ?? null,
      create: async () => {
        creates += 1;
        const row = { id: `m${creates}`, dishName, clientRequestId };
        rows.push(row);
        return row;
      },
    });

  const first = await save("req-repeat-1", "Борщ");
  const second = await save("req-repeat-1", "Борщ ещё раз");
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.row.id, first.row.id);
  assert.equal(second.row.dishName, "Борщ");
  assert.equal(rows.length, 1);
  assert.equal(creates, 1);
});

test("запрос без ключа создаёт новую запись каждый раз", async () => {
  const rows: Row[] = [];
  const save = (dishName: string) =>
    saveMealOnce<Row>({
      clientRequestId: undefined,
      findExisting: async () => {
        throw new Error("без ключа поиск не нужен");
      },
      create: async () => {
        const row = { id: `m${rows.length + 1}`, dishName, clientRequestId: null };
        rows.push(row);
        return row;
      },
    });

  const first = await save("Гречка");
  const second = await save("Гречка");
  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.notEqual(first.row.id, second.row.id);
  assert.equal(rows.length, 2);
});

test("гонка уникального индекса тоже отдаёт первую строку", async () => {
  const rows: Row[] = [{ id: "already", dishName: "Сырники", clientRequestId: "req-race-1" }];
  let looked = 0;
  const result = await saveMealOnce<Row>({
    clientRequestId: "req-race-1",
    findExisting: async (key) => {
      looked += 1;
      if (looked === 1) return null;
      return rows.find((row) => row.clientRequestId === key) ?? null;
    },
    create: async () => {
      const error = new Error("unique") as Error & { code?: string };
      error.code = "P2002";
      throw error;
    },
  });
  assert.equal(result.created, false);
  assert.equal(result.row.id, "already");
});

test("клиент ставит ключ один раз и переиспользует его", () => {
  const stamped = withClientRequestId({ dishName: "Борщ", calories: 171 });
  const again = withClientRequestId(stamped);
  assert.equal(again.clientRequestId, stamped.clientRequestId);
  assert.equal(normalizeClientRequestId("short"), null);
  assert.equal(normalizeClientRequestId(newClientRequestId())?.length, 36);

  const batch = withClientRequestIdsOnBody({
    entries: [{ dishName: "А" }, { dishName: "Б", clientRequestId: "req-keep-01" }],
  });
  assert.ok("entries" in batch);
  assert.equal(batch.entries[1]?.clientRequestId, "req-keep-01");
  assert.ok(batch.entries[0]?.clientRequestId);
  assert.deepEqual(clientRequestIdsOf(batch), [
    batch.entries[0]!.clientRequestId,
    "req-keep-01",
  ]);
});
