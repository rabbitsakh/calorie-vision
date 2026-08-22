import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeRecognizeSse } from "./recognize-sse.ts";

test("consumeRecognizeSse parses vision and done events", async () => {
  const payload = {
    imagePath: "/uploads/a.jpg",
    recognition: {
      dishName: "Борщ",
      calories: 250,
      confidence: 0.8,
      photoKind: "meal",
    },
  };

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      controller.enqueue(
        enc.encode(`event: image\ndata: ${JSON.stringify({ imagePath: payload.imagePath })}\n\n`),
      );
      controller.enqueue(
        enc.encode(
          `event: vision\ndata: ${JSON.stringify({ recognition: payload.recognition })}\n\n`,
        ),
      );
      controller.enqueue(enc.encode(`event: done\ndata: ${JSON.stringify(payload)}\n\n`));
      controller.close();
    },
  });

  const visions: string[] = [];
  const result = await consumeRecognizeSse(
    new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    {
      onVision: (recognition) => visions.push(recognition.dishName),
    },
  );

  assert.deepEqual(visions, ["Борщ"]);
  assert.equal(result.imagePath, payload.imagePath);
  assert.equal(result.recognition.dishName, "Борщ");
});
