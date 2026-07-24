import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();

    if (query.length < 2 && query.replace(/\D/g, "").length < 4) {
      return NextResponse.json({ results: [] });
    }

    const { supabase } = await requireRole(["admin", "coordinator", "finance"]);
    const { data, error } = await supabase.rpc("search_campaign_influencers", {
      p_campaign_id: id,
      p_query: query,
      p_limit: 15,
    });

    if (error) {
      console.error("Campaign influencer search failed:", error);
      return NextResponse.json(
        { message: "تعذر البحث عن المؤثرين حاليًا." },
        { status: 500 },
      );
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (error) {
    console.error("Campaign influencer search failed:", error);
    return NextResponse.json(
      { message: "تعذر البحث عن المؤثرين حاليًا." },
      { status: 500 },
    );
  }
}
