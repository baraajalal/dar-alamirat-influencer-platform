import { redirect } from "next/navigation";
import { legacySmartSuiteRoutesEnabled } from "@/lib/legacy/smartsuite";

export default function LegacyContentSubmitLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!legacySmartSuiteRoutesEnabled()) {
    redirect("/login?notice=legacy_content_submit_disabled");
  }

  return children;
}
