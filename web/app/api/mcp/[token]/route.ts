// Verdyn MCP server — the Expert (agentic) tier.
//
// A stateless Model Context Protocol endpoint (streamable HTTP, JSON responses)
// that lets a user's own AI agent (Claude, ChatGPT, or anything MCP-capable)
// read and manage their irrigation program the same way the Verdyn app does.
// The per-account agent key rides in the URL path — the pattern hosted MCP
// providers use for custom connectors — so there is nothing to configure
// beyond pasting the URL. Keys are mintable/revocable from the dashboard;
// only their SHA-256 lives in the database.
//
// Deliberately dependency-free: a compact JSON-RPC handler instead of an SDK,
// so self-hosters can read the whole protocol surface in one file.

import { NextRequest, NextResponse } from "next/server";
import {
  buildDailyPlan, weeklyPreview, GRASS_TYPES, HEAD_TYPES, PLANT_TYPES, SOIL_TYPES,
  entitlementActive, type LawnProfile,
} from "@verdyn/core";
import { accountForAgentToken } from "@/lib/agent-token-store";
import { getHomeProfile, saveHomeProfile } from "@/lib/home-profile-store";
import { getLinkStatus, setAutoRun } from "@/lib/bhyve-link-store";
import { getEntitlement } from "@/lib/entitlement-store";
import { recentRuns } from "@/lib/run-log-store";
import { validateProfile } from "@/lib/validate";
import { weatherForZip } from "@/lib/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL = "2025-03-26";

function todayISO(tz: string | null): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz || "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

// ── Tool definitions ───────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_status",
    description:
      "Overview of this Verdyn account: controller link state, automatic watering on/off, " +
      "subscription tier, and the lawn profile (zones, grass, nozzles, soil, restrictions).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_daily_plan",
    description:
      "Build today's watering plan from live weather: per-zone cycles (time + minutes), " +
      "skips, and the plain-English rationale for every decision.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_week_preview",
    description: "7-day schedule preview (base schedule, before daily weather adjustment).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "update_profile",
    description:
      "Update lawn-level settings. Only the provided fields change. " +
      `soilTextureId ∈ ${SOIL_TYPES.map((s) => s.id).join("|")}; addressParity ∈ odd|even.`,
    inputSchema: {
      type: "object",
      properties: {
        zip: { type: "string", description: "5-digit US ZIP" },
        soilTextureId: { type: "string" },
        addressParity: { type: "string", enum: ["odd", "even"] },
        establishmentStart: { type: ["string", "null"], description: "YYYY-MM-DD lawn-level planting date, null to clear" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "update_zone",
    description:
      "Update one zone by id. Only the provided fields change. " +
      `grassTypeId ∈ ${GRASS_TYPES.map((g) => g.id).join("|")}. ` +
      `headTypeId ∈ ${HEAD_TYPES.map((h) => h.id).join("|")}. ` +
      `plantTypeId ∈ ${PLANT_TYPES.map((p) => p.id).join("|")}.`,
    inputSchema: {
      type: "object",
      properties: {
        zoneId: { type: "string" },
        name: { type: "string" },
        grassTypeId: { type: "string" },
        headTypeId: { type: "string" },
        plantTypeId: { type: "string" },
        sun: { type: "string", enum: ["full_sun", "partial", "shade"] },
        slope: { type: "string", enum: ["flat", "moderate", "steep"] },
        areaSqft: { type: "number" },
        establishmentStart: { type: ["string", "null"], description: "YYYY-MM-DD per-zone planting date, null to clear" },
      },
      required: ["zoneId"],
      additionalProperties: false,
    },
  },
  {
    name: "set_auto_run",
    description: "Pause or resume automatic watering execution (does not disconnect the controller).",
    inputSchema: {
      type: "object",
      properties: { on: { type: "boolean" } },
      required: ["on"],
      additionalProperties: false,
    },
  },
  {
    name: "get_run_history",
    description: "Recent watering executions: what actually ran, was skipped, or errored, and why.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ── Tool implementations ───────────────────────────────────────────

async function requireProfile(accountId: string): Promise<{ profile: LawnProfile; timezone: string | null }> {
  const home = await getHomeProfile(accountId);
  if (!home) {
    throw new Error(
      "No lawn profile yet. Complete onboarding in the Verdyn web app first — the agent can then read and manage it.");
  }
  return { profile: home.profile, timezone: home.timezone };
}

async function callTool(accountId: string, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "get_status": {
      const [home, link, ent] = await Promise.all([
        getHomeProfile(accountId), getLinkStatus(accountId), getEntitlement(accountId),
      ]);
      return {
        controller: link,
        entitlement: { tier: ent.tier, status: ent.status, active: entitlementActive(ent) },
        profile: home?.profile ?? null,
        timezone: home?.timezone ?? null,
      };
    }
    case "get_daily_plan": {
      const { profile, timezone } = await requireProfile(accountId);
      const w = await weatherForZip(profile.zip);
      const plan = buildDailyPlan(profile, w, todayISO(timezone));
      return { weather: w, plan };
    }
    case "get_week_preview": {
      const { profile, timezone } = await requireProfile(accountId);
      const days = weeklyPreview(profile, todayISO(timezone));
      return days.map((p) => ({
        date: p.date, status: p.status,
        cycles: p.cycles.map((c) => ({ zone: c.zoneName, time: c.time, minutes: c.minutes, type: c.cycleType })),
      }));
    }
    case "update_profile": {
      const { profile, timezone } = await requireProfile(accountId);
      const next: LawnProfile = { ...profile };
      for (const k of ["zip", "soilTextureId", "addressParity", "establishmentStart"] as const) {
        if (k in args) (next as unknown as Record<string, unknown>)[k] = args[k];
      }
      const v = validateProfile(next);
      if (!v.ok) throw new Error(`Rejected: ${v.error}`);
      await saveHomeProfile(accountId, v.profile, timezone);
      return { ok: true, profile: v.profile };
    }
    case "update_zone": {
      const { profile, timezone } = await requireProfile(accountId);
      const zoneId = String(args.zoneId ?? "");
      const idx = profile.zones.findIndex((z) => z.id === zoneId);
      if (idx === -1) {
        throw new Error(`Unknown zoneId "${zoneId}". Zones: ${profile.zones.map((z) => `${z.id} (${z.name})`).join(", ")}`);
      }
      const zone = { ...profile.zones[idx] };
      for (const k of ["name", "grassTypeId", "headTypeId", "plantTypeId", "sun", "slope", "areaSqft", "establishmentStart"] as const) {
        if (k in args) (zone as Record<string, unknown>)[k] = args[k];
      }
      const next: LawnProfile = { ...profile, zones: profile.zones.map((z, i) => (i === idx ? zone : z)) };
      const v = validateProfile(next);
      if (!v.ok) throw new Error(`Rejected: ${v.error}`);
      await saveHomeProfile(accountId, v.profile, timezone);
      return { ok: true, zone: v.profile.zones[idx] };
    }
    case "set_auto_run": {
      if (typeof args.on !== "boolean") throw new Error("`on` must be a boolean.");
      await setAutoRun(accountId, args.on);
      return { ok: true, autoRun: args.on };
    }
    case "get_run_history":
      return recentRuns(accountId, 20);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC plumbing ──────────────────────────────────────────────

type RpcMessage = { jsonrpc: "2.0"; id?: number | string | null; method?: string; params?: any };

function rpcResult(id: number | string | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}
function rpcError(id: number | string | null, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

async function handleMessage(accountId: string, msg: RpcMessage) {
  const id = msg.id ?? null;
  switch (msg.method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "verdyn", version: "1.0.0" },
        instructions:
          "Verdyn manages ET/weather-driven lawn irrigation on the user's own smart controller. " +
          "Start with get_status; get_daily_plan explains today's watering decisions; " +
          "update_zone/update_profile change the program (changes apply from the next plan build).",
      });
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: TOOLS });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const result = await callTool(accountId, name, args);
        return rpcResult(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] });
      } catch (e) {
        return rpcResult(id, {
          content: [{ type: "text", text: (e as Error).message }],
          isError: true,
        });
      }
    }
    default:
      if (msg.method?.startsWith("notifications/")) return null; // acknowledged, no body
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const accountId = await accountForAgentToken(token);
  if (!accountId) {
    return NextResponse.json(rpcError(null, -32001, "Invalid or revoked agent key."), { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400 });
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(accountId, m as RpcMessage))))
      .filter((r) => r !== null);
    return out.length ? NextResponse.json(out) : new NextResponse(null, { status: 202 });
  }
  const res = await handleMessage(accountId, body as RpcMessage);
  return res ? NextResponse.json(res) : new NextResponse(null, { status: 202 });
}

// Streamable-HTTP servers MAY be POST-only; a GET politely says so.
export async function GET() {
  return NextResponse.json(
    { error: "This is a POST-only (stateless) MCP endpoint. Add it to your agent as a custom connector URL." },
    { status: 405 });
}
