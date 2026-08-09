// Catalog invariants — keep the brand listing honest so the UI never promises
// an integration that isn't wired.
//   npx tsx --test packages/core/src/controllers/catalog.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTROLLER_CATALOG, liveBrands, brandBySlug } from "./catalog.ts";
import { coreProviders } from "./index.ts";

const STATUSES = new Set(["live", "beta", "coming_soon"]);
const CATEGORIES = new Set(["controller", "hose_timer"]);

test("slugs are unique and non-empty", () => {
  const slugs = CONTROLLER_CATALOG.map((b) => b.slug);
  assert.ok(slugs.every((s) => typeof s === "string" && s.length > 0));
  assert.equal(new Set(slugs).size, slugs.length, "duplicate slug in catalog");
});

test("every entry has a valid status and category", () => {
  for (const b of CONTROLLER_CATALOG) {
    assert.ok(STATUSES.has(b.status), `bad status for ${b.slug}`);
    assert.ok(CATEGORIES.has(b.category), `bad category for ${b.slug}`);
    assert.ok(typeof b.name === "string" && b.name.length > 0);
  }
});

test("a live brand has a provider and a matching coreProviders impl", () => {
  const live = liveBrands();
  assert.ok(live.length >= 1, "expected at least one live brand");
  for (const b of live) {
    assert.ok(b.provider, `${b.slug} is live but has no provider`);
    assert.ok(coreProviders[b.provider], `no provider impl for ${b.provider}`);
    assert.equal(coreProviders[b.provider].brand, b.provider);
  }
});

test("a coming-soon brand never claims a provider", () => {
  for (const b of CONTROLLER_CATALOG) {
    if (b.status === "coming_soon") {
      assert.equal(b.provider, undefined, `${b.slug} is coming soon but has a provider`);
    }
  }
});

test("brandBySlug finds known brands and misses unknown ones", () => {
  assert.equal(brandBySlug("bhyve")?.status, "live");
  assert.equal(brandBySlug("rachio")?.status, "coming_soon");
  assert.equal(brandBySlug("not-a-brand"), undefined);
});

test("the catalog lists both controllers and hose-bib timers", () => {
  assert.ok(CONTROLLER_CATALOG.some((b) => b.category === "controller"));
  assert.ok(CONTROLLER_CATALOG.some((b) => b.category === "hose_timer"));
});
