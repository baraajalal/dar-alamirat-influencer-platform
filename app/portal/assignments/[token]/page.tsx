import GuestAssignmentClient from "./guest-assignment-client";

export const dynamic = "force-dynamic";

export default async function GuestAssignmentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <GuestAssignmentClient token={token} />;
}
