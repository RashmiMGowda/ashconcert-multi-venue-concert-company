import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { once } from "node:events";

let server;
let baseUrl;
let tempDir;
let databasePath;

before(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "ashconcert-test-"));
  const port = 31000 + Math.floor(Math.random() * 15000);
  baseUrl = `http://127.0.0.1:${port}`;
  databasePath = join(tempDir, "test.sqlite");
  server = spawn(process.execPath, ["index.mjs"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: String(port), DATABASE_PATH: databasePath },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const timeout = setTimeout(() => server.kill("SIGTERM"), 5000);
  server.stdout.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  server.stderr.setEncoding("utf8").on("data", (chunk) => { output += chunk; });
  while (!output.includes("listening at")) {
    if (server.exitCode !== null) throw new Error(`Test server exited during startup: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  clearTimeout(timeout);
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await once(server, "exit");
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("lists concerts and filters them by city", async () => {
  const response = await fetch(`${baseUrl}/api/events?city=Phoenix`);
  assert.equal(response.status, 200);
  const { events } = await response.json();
  assert.equal(events.length, 1);
  assert.equal(events[0].artist, "Arctic Monkeys");
  assert.ok(events[0].tickets.length > 0);
});

test("creates a reservation and persists it in SQLite", async () => {
  const response = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: 2040, ticketOptionId: 7040, quantity: 2, name: "Riley Hart", email: "riley@example.com" }),
  });
  assert.equal(response.status, 201);
  const { booking } = await response.json();
  assert.equal(booking.total, 140);
  assert.match(booking.reference, /^AC-[A-F0-9]{8}$/);

  const database = new DatabaseSync(databasePath, { readOnly: true });
  const savedBooking = database.prepare("SELECT quantity, total FROM bookings WHERE reference = ?").get(booking.reference);
  database.close();
  assert.deepEqual({ ...savedBooking }, { quantity: 2, total: 140 });
});

test("rejects invalid quantities, malformed JSON, and tickets from another show", async () => {
  const invalidQuantity = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: 2040, ticketOptionId: 7040, quantity: 9, name: "Riley Hart", email: "riley@example.com" }),
  });
  assert.equal(invalidQuantity.status, 400);

  const mismatchedTicket = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId: 2041, ticketOptionId: 7040, quantity: 1, name: "Riley Hart", email: "riley@example.com" }),
  });
  assert.equal(mismatchedTicket.status, 404);

  const malformedJson = await fetch(`${baseUrl}/api/bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });
  assert.equal(malformedJson.status, 400);
});
