import type { ControllerStatus } from "@verdyn/core";

// Small status pill for a controller brand. Shared by the marketing
// integrations strip and the onboarding brand picker so the two never drift.
const STYLES: Record<ControllerStatus, { label: string; cls: string }> = {
  live: { label: "✓ Live", cls: "bg-green/10 text-green" },
  beta: { label: "Beta", cls: "bg-clay/15 text-clay" },
  coming_soon: { label: "Coming soon", cls: "bg-pine/5 text-pine/50" },
};

export function StatusBadge({ status }: { status: ControllerStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
}
