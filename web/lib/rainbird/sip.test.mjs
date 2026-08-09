// Tests for the Rain Bird SIP command + crypto layer. Hardware-independent:
// every vector is derived from the published protocol (node-rainbird /
// pyrainbird), so these prove correctness without a controller.
//   npx tsx --test web/lib/rainbird/sip.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  decToHex, addPadding, buildSipBody, runStationBody, stopIrrigationBody,
  serialNumberBody, encryptRequest, decryptResponse, readSipResult,
} from "./sip.ts";

test("decToHex pads and uppercases", () => {
  assert.equal(decToHex(0), "00");
  assert.equal(decToHex(10), "0A");
  assert.equal(decToHex(2, 4), "0002");
  assert.equal(decToHex(255, 4), "00FF");
});

test("addPadding right-fills 0x10 to a 16-byte block (full block when aligned)", () => {
  assert.equal(addPadding("a").length, 16);          // 1 -> 16
  assert.equal(addPadding("a".repeat(15)).length, 16);
  assert.equal(addPadding("a".repeat(16)).length, 32); // aligned -> add full block
  assert.ok(addPadding("xyz").endsWith("\x10"));
});

test("buildSipBody emits the exact SIP data hex and validates length", () => {
  // Run station 2 for 10 min: opcode 39 | station(4) 0002 | minutes(2) 0A.
  assert.deepEqual(runStationBody(2, 10).params, { data: "3900020A", length: 4 });
  // Stop: opcode 40, no params, 1 byte.
  assert.deepEqual(stopIrrigationBody().params, { data: "40", length: 1 });
  // Serial: opcode 05, 1 byte.
  assert.deepEqual(serialNumberBody().params, { data: "05", length: 1 });
  // Envelope shape.
  const b = runStationBody(1, 5);
  assert.equal(b.method, "tunnelSip");
  assert.equal(b.jsonrpc, "2.0");
});

test("buildSipBody rejects a wrong-length param (guards against a bug)", () => {
  // ManuallyRunStationRequest wants 4 bytes total; feed a 2-hex (1-byte) station.
  assert.throws(() => buildSipBody("ManuallyRunStationRequest", "0A"), /expected 4 bytes/);
});

test("encryptRequest framing: SHA256(json) | IV | block-aligned ciphertext", () => {
  const password = "test-key";
  const iv = Buffer.alloc(16, 7); // fixed IV -> deterministic
  const body = runStationBody(3, 12);
  const json = JSON.stringify(body);

  const frame = encryptRequest(password, body, iv);
  assert.deepEqual(frame.subarray(0, 32), createHash("sha256").update(Buffer.from(json, "utf8")).digest());
  assert.deepEqual(frame.subarray(32, 48), iv);
  assert.equal((frame.length - 48) % 16, 0, "ciphertext must be block-aligned");
  // Deterministic IV => deterministic frame.
  assert.deepEqual(encryptRequest(password, body, iv), frame);
});

test("encrypt -> decrypt round-trips the SIP body exactly", () => {
  const password = "s3cr3t-controller-key";
  const body = runStationBody(5, 8);
  const frame = encryptRequest(password, body, Buffer.alloc(16, 1));
  assert.deepEqual(decryptResponse(password, frame), body);
});

test("a wrong password fails to recover the body (key is SHA256(password))", () => {
  const body = stopIrrigationBody();
  const frame = encryptRequest("right-password", body, Buffer.alloc(16, 2));
  // Wrong key -> garbage plaintext -> JSON.parse throws (or mismatched object).
  assert.throws(() => decryptResponse("wrong-password", frame));
});

test("readSipResult returns the ack hex and raises on a controller error", () => {
  assert.equal(readSipResult({ result: { data: "0100", length: 2 } }), "0100");
  assert.throws(
    () => readSipResult({ error: { code: 2, message: "bad" } }),
    /controller error 2/,
  );
});
