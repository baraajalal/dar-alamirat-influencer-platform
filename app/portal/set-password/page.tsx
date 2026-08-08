import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetPasswordClient from "./set-password-client";

export const dynamic = "force-dynamic";

export default async function PortalSetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ assignment?: string | string[] }>;
}) {
  const params = await searchParams;
  const assignmentId =
    typeof params.assignment === "string" ? params.assignment : "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=invalid_activation_session");
  }

  return <SetPasswordClient assignmentId={assignmentId} />;
}
