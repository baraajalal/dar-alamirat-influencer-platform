import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRegistrationRateLimit } from "@/lib/influencers/rate-limit";

export const dynamic = "force-dynamic";

const payloadSchema = z.object({
  kind: z.enum(["city", "country"]),
  value: z.string().trim().min(2).max(80),
  mobile: z.string().trim().max(30).optional().default(""),
});

function cleanValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("creator_location_options")
      .select("kind,value")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("value", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      cities: (data ?? []).filter((item) => item.kind === "city").map((item) => item.value),
      countries: (data ?? []).filter((item) => item.kind === "country").map((item) => item.value),
    });
  } catch (error) {
    console.error("LOCATION_OPTIONS_GET_ERROR", error);
    return NextResponse.json({ cities: [], countries: [] });
  }
}

export async function POST(request: Request) {
  try {
    const parsed = payloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "خيار الموقع غير صالح" }, { status: 400 });
    }

    const value = cleanValue(parsed.data.value);
    if (!value) {
      return NextResponse.json({ success: false, message: "الخيار فارغ" }, { status: 400 });
    }

    await enforceRegistrationRateLimit({
      request,
      action: "location-option",
      mobile: parsed.data.mobile || undefined,
      limit: 30,
    });

    const admin = createAdminClient();
    const { error } = await admin
      .from("creator_location_options")
      .upsert(
        {
          kind: parsed.data.kind,
          value,
          normalized_value: value.toLocaleLowerCase("en"),
          source: "creator_input",
          is_active: true,
        },
        { onConflict: "kind,normalized_value", ignoreDuplicates: true },
      );

    if (error) throw error;
    return NextResponse.json({ success: true, value });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json({ success: false, message: "تم تجاوز عدد المحاولات المسموح بها مؤقتًا" }, { status: 429 });
    }
    console.error("LOCATION_OPTIONS_POST_ERROR", error);
    return NextResponse.json({ success: false, message: "تعذر حفظ الخيار الآن" }, { status: 500 });
  }
}
