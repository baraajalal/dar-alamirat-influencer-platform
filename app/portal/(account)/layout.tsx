import PortalShell from "@/components/influencer-portal/portal-shell";
import { requireInfluencerAccount } from "@/lib/influencer-portal/require-influencer-account";

export const dynamic = "force-dynamic";

export default async function InfluencerAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { influencer } = await requireInfluencerAccount();

  return (
    <PortalShell
      influencerName={influencer.full_name}
      profileCompletion={influencer.profile_completion ?? 0}
    >
      {children}
    </PortalShell>
  );
}
