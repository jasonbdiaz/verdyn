// Adapts the existing B-hyve client (../bhyve.ts) to the ControllerProvider
// interface. Pure wrapper — no behavior change to B-hyve. Translates BhyveError
// into the brand-neutral ControllerError (preserving .status) so the executor's
// 401 -> reauth path can stay brand-agnostic.

import * as bhyve from "../bhyve";
import { BhyveError, type BhyveSession } from "../bhyve";
import {
  ControllerError, type ControllerProvider, type ControllerSession,
} from "./types";

/** Strip the brand tag back to the plain BhyveSession the client expects. */
function toBhyve(s: ControllerSession): BhyveSession {
  return { token: s.token, userId: s.userId };
}

/** Run a B-hyve call, re-throwing its BhyveError as a ControllerError so callers
 *  depend only on the neutral type. Non-Bhyve errors pass through untouched. */
async function adapt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof BhyveError) throw new ControllerError(e.message, e.status);
    throw e;
  }
}

export const bhyveProvider: ControllerProvider = {
  brand: "bhyve",
  async login(email, password) {
    const s = await adapt(() => bhyve.login(email, password));
    return { provider: "bhyve", token: s.token, userId: s.userId };
  },
  listDevices(session) {
    return adapt(() => bhyve.listDevices(toBhyve(session)));
  },
  runZone(session, deviceId, station, minutes) {
    return adapt(() => bhyve.runZone(toBhyve(session), deviceId, station, minutes));
  },
  stopZone(session, deviceId) {
    return adapt(() => bhyve.stopZone(toBhyve(session), deviceId));
  },
  stopAllZones(session) {
    // stopAllZones already swallows per-device failures internally.
    return adapt(() => bhyve.stopAllZones(toBhyve(session)));
  },
};
