// B-hyve client abstraction. Wraps Orbit's unofficial cloud API used by the
// B-hyve mobile app. There is no public/official API, so this is intentionally
// thin and defensive — every call is wrapped, failures are explicit, and the
// surface is small (auth, list devices/zones, start/stop a zone).
//
// Zone commands go over Orbit's realtime WebSocket (`change_mode` events after
// an `app_connection` handshake) — the same channel the mobile app uses, and
// the transport proven live by the CXLINKS system since project start. The
// socket is reached via the global `WebSocket` constructor (present in React
// Native and Node ≥22), keeping this module free of node-only imports so it
// bundles for Expo. Environments without a global WebSocket fall back to a
// REST approximation that has NOT been verified against the live Orbit API.
//
// SECURITY: credentials are accepted only to mint a session token. Callers
// should persist the token (encrypted), never the raw password.

const BASE = "https://api.orbitbhyve.com/v1";
const WS_URL = "wss://api.orbitbhyve.com/v1/events";
const TIMEOUT_MS = 10000;
const COMMAND_RETRIES = 2;

export class BhyveError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "BhyveError";
  }
}

export interface BhyveSession {
  token: string;
  userId: string;
}

export interface BhyveZone {
  station: number;
  name: string;
}

export interface BhyveDevice {
  id: string;
  name: string;
  zones: BhyveZone[];
}

/** AbortSignal.timeout equivalent that also works on RN/Hermes. */
function timeoutSignal(ms: number): AbortSignal {
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}

async function req(path: string, init: RequestInit & { token?: string } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "orbit-app-id": "Orbit Support Dashboard",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.token) headers["orbit-session-token"] = init.token;
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, headers, signal: timeoutSignal(TIMEOUT_MS) });
  } catch (e) {
    throw new BhyveError(`Network error reaching B-hyve: ${(e as Error).message}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new BhyveError(`B-hyve API ${res.status}: ${body.slice(0, 160)}`, res.status);
  }
  return res.json();
}

/** Exchange B-hyve credentials for a session token. */
export async function login(email: string, password: string): Promise<BhyveSession> {
  const data = await req("/session", {
    method: "POST",
    body: JSON.stringify({ session: { email, password } }),
  });
  // `orbit_session_token` is the live-verified field; `orbit_api_key` kept as a
  // tolerance in case Orbit varies the response shape across account types.
  const token = data?.orbit_session_token ?? data?.orbit_api_key;
  if (!token || !data?.user_id) {
    throw new BhyveError("B-hyve login did not return a session token.");
  }
  return { token, userId: data.user_id };
}

/** List the user's controllers and their zones. */
export async function listDevices(session: BhyveSession): Promise<BhyveDevice[]> {
  const data = await req(`/devices?user_id=${encodeURIComponent(session.userId)}`, {
    token: session.token,
  });
  const devices = Array.isArray(data) ? data : [];
  return devices.map((d: any) => ({
    id: String(d.id),
    name: String(d.name ?? "Controller"),
    zones: (d.zones ?? []).map((z: any) => ({
      station: Number(z.station),
      name: String(z.name ?? `Zone ${z.station}`),
    })),
  }));
}

// ── realtime command channel ───────────────────────────────────────

/** Browser-style WebSocket surface — the least-common denominator across the
 *  RN and Node ≥22 globals. */
interface WsLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: "open" | "error", cb: (ev: unknown) => void): void;
}

function wsCtor(): (new (url: string) => WsLike) | null {
  const g = globalThis as Record<string, unknown>;
  return typeof g.WebSocket === "function" ? (g.WebSocket as new (url: string) => WsLike) : null;
}

function sendWsOnce(
  Ws: new (url: string) => WsLike, token: string, event: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const ws = new Ws(WS_URL);
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      err ? reject(err) : resolve();
    };
    const timer = setTimeout(
      () => finish(new BhyveError("B-hyve realtime socket timeout")), TIMEOUT_MS,
    );
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ event: "app_connection", orbit_session_token: token }));
      ws.send(JSON.stringify(event));
      // Give the command a moment to land before closing the socket.
      setTimeout(() => finish(), 1000);
    });
    ws.addEventListener("error", () => finish(new BhyveError("B-hyve realtime socket error")));
  });
}

async function sendCommand(session: BhyveSession, event: Record<string, unknown>): Promise<void> {
  const Ws = wsCtor();
  if (!Ws) return sendCommandRest(session, event);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= COMMAND_RETRIES; attempt++) {
    try {
      await sendWsOnce(Ws, session.token, event);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof BhyveError
    ? lastErr
    : new BhyveError(`B-hyve command failed after ${COMMAND_RETRIES} attempts: ${lastErr}`);
}

/** UNVERIFIED fallback for WebSocket-less environments: the REST shape this
 *  module used before the proven realtime transport was ported in. */
async function sendCommandRest(session: BhyveSession, event: Record<string, unknown>): Promise<void> {
  const stations = event.stations as { station: number; run_time: number }[];
  await req(`/devices/${encodeURIComponent(String(event.device_id))}`, {
    method: "PUT",
    token: session.token,
    body: JSON.stringify({
      device: stations.length
        ? {
            manual_preset_runtime_sec: Math.round(stations[0].run_time * 60),
            stations,
          }
        : { rain_delay: 0, stations: [] },
    }),
  });
}

/** Start watering a zone for `minutes` via a realtime `change_mode` event. */
export async function runZone(
  session: BhyveSession, deviceId: string, station: number, minutes: number,
): Promise<void> {
  await sendCommand(session, {
    event: "change_mode",
    mode: "manual",
    device_id: deviceId,
    timestamp: new Date().toISOString(),
    stations: [{ station, run_time: minutes }],
  });
}

/** Stop any manual watering on a controller (empty station list = all off). */
export async function stopZone(session: BhyveSession, deviceId: string): Promise<void> {
  await sendCommand(session, {
    event: "change_mode",
    mode: "manual",
    device_id: deviceId,
    timestamp: new Date().toISOString(),
    stations: [],
  });
}

/**
 * Stop watering on every controller on the account. Used when a subscription is
 * cancelled so no Verdyn-initiated cycle keeps running. Best-effort and resilient:
 * one device failing does not abort the rest. Returns which devices were stopped
 * and any that errored, so the caller can report honestly.
 */
export async function stopAllZones(
  session: BhyveSession,
): Promise<{ stopped: string[]; failed: { name: string; error: string }[] }> {
  const devices = await listDevices(session);
  const stopped: string[] = [];
  const failed: { name: string; error: string }[] = [];
  for (const d of devices) {
    try {
      await stopZone(session, d.id);
      stopped.push(d.name);
    } catch (e) {
      failed.push({ name: d.name, error: (e as Error).message });
    }
  }
  return { stopped, failed };
}
