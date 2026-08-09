// Verdyn mobile theme — sources colors from the shared core brand tokens so
// web and iOS stay visually identical.
import { colors, brand } from "@verdyn/core";

export const C = colors;
export const BRAND = brand;

export const GRADIENT = ["#0E7C5A", "#8BE04A"] as const;

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };
export const space = { xs: 6, sm: 10, md: 16, lg: 24, xl: 36 };

export const statusStyle: Record<string, { bg: string; fg: string; label: string }> = {
  scheduled: { bg: "rgba(14,124,90,0.10)", fg: C.green, label: "Watering" },
  adjusted: { bg: "rgba(232,161,58,0.15)", fg: C.clay, label: "Adjusted" },
  skipped: { bg: "rgba(229,84,75,0.10)", fg: C.ember, label: "Skipped" },
  rest: { bg: "rgba(156,180,168,0.18)", fg: "#9CB4A8", label: "Rest day" },
};

export const phaseStyle: Record<string, { bg: string; fg: string; label: string }> = {
  establishment: { bg: "rgba(22,182,196,0.15)", fg: C.tide, label: "Establishment" },
  transition: { bg: "rgba(232,161,58,0.15)", fg: C.clay, label: "Transition" },
  established: { bg: "rgba(14,124,90,0.10)", fg: C.green, label: "Established" },
};
