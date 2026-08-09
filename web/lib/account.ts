// Server-side helpers to read the current authenticated account from its sealed
// cookie and resolve its entitlement. Use these in API routes / server
// components to gate features — never trust a client-supplied tier.
import { cookies } from "next/headers";
import { NO_ENTITLEMENT, type Entitlement } from "@verdyn/core";
import { ACCOUNT_COOKIE, sealObject, unsealObject } from "./session";
import { getEntitlement } from "./entitlement-store";

interface AccountSession {
  accountId: string;
}

/** Seal an account id into the cookie value. */
export const sealAccount = (accountId: string): string => sealObject({ accountId } as AccountSession);

/** The current account id from the sealed cookie, or null if not signed in. */
export async function currentAccountId(): Promise<string | null> {
  const jar = await cookies();
  const sess = unsealObject<AccountSession>(jar.get(ACCOUNT_COOKIE)?.value);
  return sess && typeof sess.accountId === "string" ? sess.accountId : null;
}

/** The current account's entitlement, or NO_ENTITLEMENT when unauthenticated. */
export async function currentEntitlement(): Promise<Entitlement> {
  const id = await currentAccountId();
  return id ? getEntitlement(id) : NO_ENTITLEMENT;
}
