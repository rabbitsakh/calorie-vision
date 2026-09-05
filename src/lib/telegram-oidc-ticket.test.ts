import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTelegramLoginTicket,
  verifyTelegramLoginTicket,
} from "./telegram-oidc-ticket.ts";

describe("telegram OIDC login ticket", () => {
  it("round-trips a signed ticket with phone", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-telegram-ticket";
    const ticket = createTelegramLoginTicket({
      id: "42",
      first_name: "Иван",
      phone_number: "79001234567",
    });
    const payload = verifyTelegramLoginTicket(ticket);
    assert.ok(payload);
    assert.equal(payload.id, "42");
    assert.equal(payload.first_name, "Иван");
    assert.equal(payload.phone_number, "79001234567");
  });

  it("rejects tampered tickets", () => {
    process.env.NEXTAUTH_SECRET = "test-secret-for-telegram-ticket";
    const ticket = createTelegramLoginTicket({ id: "1" });
    assert.equal(verifyTelegramLoginTicket(`${ticket}x`), null);
    assert.equal(verifyTelegramLoginTicket("not-a-ticket"), null);
  });
});
