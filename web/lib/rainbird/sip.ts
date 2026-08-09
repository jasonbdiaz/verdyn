// Rain Bird SIP protocol — the transport-agnostic command + crypto layer.
//
// A Rain Bird controller (via the LNK WiFi module) speaks an AES-encrypted SIP
// JSON-RPC. The SAME encrypted payload is used in all three connection modes
// (AP / LAN / cloud relay) — only the transport differs. So this module builds
// and decodes the encrypted blob and knows nothing about HTTP; the provider
// (provider.ts) handles the transport, including the cloud relay we're targeting.
//
// Faithful TypeScript port of node-rainbird (bbreukelen/node-rainbird, index.js)
// and pyrainbird (allenporter/pyrainbird, encryption.py):
//   key       = SHA256(utf8(password))                      // AES-256
//   plaintext = JSON.stringify(body) + "\x00\x10", then     // SIP envelope
//               right-padded with 0x10 to a 16-byte block   // manual PKCS-ish
//   frame     = SHA256(utf8(json)) | IV(16) | AES-256-CBC(key, IV, plaintext)
// CBC auto-padding MUST be disabled (the padding above is manual) — which is why
// this needs node:crypto rather than Web Crypto (whose AES-CBC forces PKCS7).
//
// SECURITY: the password is used only to derive the cipher key; we never persist
// it. The provider mints/stores a session, mirroring the B-hyve token model.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const BLOCK = 16;

/** One SIP controller command: its hex opcode and the exact byte length of the
 *  full (opcode + params) data string. Subset Verdyn needs; opcodes match the
 *  Rain Bird SIP table used by node-rainbird/pyrainbird. */
interface SipCommand {
  command: string; // hex opcode
  length: number;  // total bytes of opcode+params
  response: string; // expected response opcode (hex)
}

export const SIP_COMMANDS = {
  SerialNumberRequest: { command: "05", length: 1, response: "85" },
  AvailableStationsRequest: { command: "03", length: 2, response: "83" },
  ManuallyRunStationRequest: { command: "39", length: 4, response: "01" },
  StopIrrigationRequest: { command: "40", length: 1, response: "01" },
} as const satisfies Record<string, SipCommand>;

export type SipCommandName = keyof typeof SIP_COMMANDS;

/** The JSON-RPC envelope the controller expects, wrapping a raw SIP data hex. */
export interface TunnelSipBody {
  id: number;
  jsonrpc: "2.0";
  method: "tunnelSip";
  params: { data: string; length: number };
}

/** Unsigned int -> uppercase hex, left-padded to `len` chars (default 2). */
export function decToHex(value: number, len = 2): string {
  return Math.abs(value).toString(16).toUpperCase().padStart(len, "0");
}

/** Right-pad with 0x10 to the next 16-byte boundary (adds a full block when
 *  already aligned). Mirrors node-rainbird's addPadding exactly. */
export function addPadding(data: string): string {
  const charsToAdd = BLOCK - (data.length % BLOCK);
  return data + "\x10".repeat(charsToAdd);
}

/** Assemble a tunnelSip body for a named command + its hex params. Validates the
 *  param byte-length against the command table (a wrong-length param is a bug). */
export function buildSipBody(name: SipCommandName, ...params: string[]): TunnelSipBody {
  const def = SIP_COMMANDS[name];
  const data = def.command + params.join("");
  if (data.length / 2 !== def.length) {
    throw new Error(`SIP ${name}: expected ${def.length} bytes, got ${data.length / 2}`);
  }
  return { id: 9, jsonrpc: "2.0", method: "tunnelSip", params: { data, length: def.length } };
}

// --- Convenience builders for the commands Verdyn actually issues ----------

/** Start a station (1-based) for `minutes`. */
export function runStationBody(station: number, minutes: number): TunnelSipBody {
  return buildSipBody("ManuallyRunStationRequest", decToHex(station, 4), decToHex(minutes));
}

/** Stop all irrigation on the controller. */
export function stopIrrigationBody(): TunnelSipBody {
  return buildSipBody("StopIrrigationRequest");
}

/** Probe the controller's serial — a cheap liveness/auth check. */
export function serialNumberBody(): TunnelSipBody {
  return buildSipBody("SerialNumberRequest");
}

/** Ask which stations are available (parameter page 0). */
export function availableStationsBody(): TunnelSipBody {
  return buildSipBody("AvailableStationsRequest", decToHex(0));
}

// --- Crypto ----------------------------------------------------------------

function key(password: string): Buffer {
  return createHash("sha256").update(Buffer.from(password, "utf8")).digest();
}

/**
 * Encrypt a SIP body into the wire frame: SHA256(json) | IV | ciphertext.
 * `iv` is injectable purely for deterministic tests; production passes none and
 * a fresh random IV is used per request.
 */
export function encryptRequest(password: string, body: TunnelSipBody, iv?: Buffer): Buffer {
  const json = JSON.stringify(body);
  const plaintext = Buffer.from(addPadding(`${json}\x00\x10`), "utf8");
  const ivBuf = iv ?? randomBytes(16);
  const hashedBody = createHash("sha256").update(Buffer.from(json, "utf8")).digest();
  const cipher = createCipheriv("aes-256-cbc", key(password), ivBuf);
  cipher.setAutoPadding(false); // padding is manual (0x10) — must not double-pad
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([hashedBody, ivBuf, ciphertext]);
}

/**
 * Decrypt a wire frame back to the parsed JSON-RPC response. Strips the SIP
 * padding/sentinel bytes (0x10/0x0A/0x00) before JSON.parse.
 */
export function decryptResponse(password: string, data: Buffer): any {
  const iv = data.subarray(32, 48);
  const ciphertext = data.subarray(48);
  const decipher = createDecipheriv("aes-256-cbc", key(password), iv);
  decipher.setAutoPadding(false);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  // eslint-disable-next-line no-control-regex
  return JSON.parse(plain.replace(/[\x10\x0A\x00]/g, ""));
}

/** Pull the SIP result data-hex out of a decoded response, raising on a SIP-level
 *  error. Returns the hex string (e.g. an ack "01...") for the caller to inspect. */
export function readSipResult(decoded: any): string {
  if (decoded?.error) {
    throw new Error(`Rain Bird controller error ${decoded.error.code}: ${decoded.error.message}`);
  }
  const data = decoded?.result?.data;
  if (typeof data !== "string") throw new Error("Rain Bird: malformed SIP response");
  return data;
}
