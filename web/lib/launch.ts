// Launch gate for the hosted product.
//
// While false, the hosted sign-up/onboarding and pricing flows render a
// "coming soon" screen instead of going live — the public site stays
// informational until the payment portal (Stripe) is stood up. Everything is
// still in the repo and one flip away: set this to true (or wire it to an env
// flag) once billing is ready. Self-hosting is unaffected — that path is the
// open-source repo, always available.
export const LAUNCHED = false;
