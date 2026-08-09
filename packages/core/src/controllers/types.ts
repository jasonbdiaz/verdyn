// Provider-neutral irrigation-controller abstraction.
//
// Verdyn started B-hyve-only (packages/core/src/bhyve.ts). To support a second
// brand (Rain Bird) without touching the executor's safety logic, every brand
// implements this one small interface and the executor talks only to it. The
// interface is intentionally the same shape the proven B-hyve client already
// has — auth, list devices/zones, run/stop a zone — so adapting B-hyve is trivial.
//
// SECURITY: a session carries only a minted token (+ ids), never the raw
// password — matching the B-hyve model. Callers persist the token sealed.

export type ControllerBrand = "bhyve" | "rainbird";

/** Uniform error so the executor's 401 -> reauth path is brand-agnostic. The
 *  `status` field is load-bearing: web/lib/execute.ts keys reauth off it. */
export class ControllerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ControllerError";
  }
}

/** A brand-tagged, password-free session. Brand-specific extras (e.g. a Rain
 *  Bird controller's local key) ride along in the index signature, but the
 *  token/userId pair is what every brand persists. */
export interface ControllerSession {
  provider: ControllerBrand;
  token: string;
  userId: string;
  [extra: string]: unknown;
}

export interface ControllerZone {
  station: number;
  name: string;
}

export interface ControllerDevice {
  id: string;
  name: string;
  zones: ControllerZone[];
}

/** Result of a best-effort stop-everything sweep (used on cancellation). */
export interface StopAllResult {
  stopped: string[];
  failed: { name: string; error: string }[];
}

/** The whole surface a brand must implement. Mirrors bhyve.ts exactly so the
 *  executor can call any controller through one seam. */
export interface ControllerProvider {
  readonly brand: ControllerBrand;
  /** Exchange credentials for a token-only session. */
  login(email: string, password: string): Promise<ControllerSession>;
  /** List the account's controllers and their zones/stations. */
  listDevices(session: ControllerSession): Promise<ControllerDevice[]>;
  /** Start watering one station for `minutes`. */
  runZone(
    session: ControllerSession, deviceId: string, station: number, minutes: number,
  ): Promise<void>;
  /** Stop watering on one controller. */
  stopZone(session: ControllerSession, deviceId: string): Promise<void>;
  /** Best-effort stop on every controller; one failure never aborts the rest. */
  stopAllZones(session: ControllerSession): Promise<StopAllResult>;
}
