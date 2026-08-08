import ActivationClient from "./activation-client";

export const dynamic = "force-dynamic";

export default async function ActivateInfluencerAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return <ActivationClient token={token} />;
}
