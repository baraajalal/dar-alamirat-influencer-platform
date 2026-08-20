import PortalAccessActivateClient from "./activate-client";

type ActivatePageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function PortalAccessActivatePage({ searchParams }: ActivatePageProps) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] ?? "" : rawToken ?? "";

  return <PortalAccessActivateClient token={token} />;
}
