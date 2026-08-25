import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function StaffSetPasswordPage() {
  redirect("/staff/login?error=legacy_activation_disabled");
}
