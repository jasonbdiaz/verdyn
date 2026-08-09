// Brand-neutral controller layer. Re-exports the interface + types and the
// universal (fetch-only) providers safe for every target (web + Expo mobile).
//
// The Rain Bird provider is intentionally NOT exported here: its AES-SIP layer
// needs node:crypto (CBC with padding disabled — Web Crypto can't express it),
// which would break the mobile bundler. It lives server-side in web/lib/rainbird
// and is composed into a registry there.

export * from "./types";
export * from "./catalog";
export { bhyveProvider } from "./bhyve-provider";

import type { ControllerBrand, ControllerProvider } from "./types";
import { bhyveProvider } from "./bhyve-provider";

/** Universal providers, by brand. Server code (web) extends this with Rain Bird. */
export const coreProviders: Partial<Record<ControllerBrand, ControllerProvider>> = {
  bhyve: bhyveProvider,
};
