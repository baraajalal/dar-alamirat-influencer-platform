import CompleteAccountClient from "./complete-account-client";

export const dynamic = "force-dynamic";

export default async function CompleteAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return <CompleteAccountClient token={token} />;
}
