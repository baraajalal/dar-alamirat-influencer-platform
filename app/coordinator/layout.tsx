import { redirect } from "next/navigation";
import { legacySmartSuiteRoutesEnabled } from "@/lib/legacy/smartsuite";

export default function LegacyCoordinatorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!legacySmartSuiteRoutesEnabled()) {
    redirect("/login?notice=legacy_coordinator_disabled");
  }

  return children;
}
