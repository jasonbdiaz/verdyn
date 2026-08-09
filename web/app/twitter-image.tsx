// Reuse the same card for the Twitter/X summary_large_image. `runtime` must be a
// literal export here (Next can't statically read a re-exported runtime).
export const runtime = "edge";
export { default, alt, size, contentType } from "./opengraph-image";
