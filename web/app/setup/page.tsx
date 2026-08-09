import { SetupWizard } from "@/components/SetupWizard";

// The authenticated "continue setup" view. Reached right after signing in via
// the magic link (the dashboard sends new accounts here) — it connects the
// controller and configures zones/property, then drops into the live dashboard.
export default function SetupPage() {
  return <SetupWizard />;
}
