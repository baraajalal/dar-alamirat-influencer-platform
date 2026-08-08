import { NextRequest, NextResponse } from "next/server";
import { requireGuestSession } from "@/lib/guest-portal/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


type GuestContentItemRow = {
  id: string;
  sequence_no: number;
  content_type: string;
  status: string;
  post_url: string | null;
  promo_code: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  latest_version_id: string | null;
  publication_verified_at: string | null;
};

type GuestPlatformRow = {
  id: string;
  required_deliverables: unknown;
  social_accounts: {
    id: string;
    platform: string;
    username: string;
    profile_url: string | null;
  } | null;
  content_items: GuestContentItemRow[];
};

type GuestVersionRow = {
  id: string;
  content_item_id: string;
  version_no: number;
  file_path: string | null;
  external_url: string | null;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  notes: string | null;
  review_status: string;
  submitted_at: string;
};

type GuestReviewRow = {
  id: string;
  content_item_id: string;
  decision: string;
  notes: string | null;
  created_at: string;
};

type GuestPublicationRow = {
  id: string;
  content_item_id: string;
  platform: string;
  post_url: string;
  published_at: string | null;
  screenshot_path: string | null;
  submitter_notes: string | null;
  status: string;
  review_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
    const session = await requireGuestSession(token);

    if (!session) {
      return NextResponse.json({ message: "يجب التحقق من رقم الجوال أولًا." }, { status: 401 });
    }

    const { admin, assignmentId } = session;

    const { data: assignment, error: assignmentError } = await admin
      .from("campaign_assignments")
      .select("id,status,execution_type,other_execution_details,requires_content,content_due_at,publishing_date,branch,attendance_at,order_number,order_code,has_contract,contract_reference,agreement_date,payment_timing,agreed_amount,currency,campaigns(id,name,brand,product,campaign_type,brief,start_date,end_date,hashtags,reference_links),influencers(id,full_name,mobile_e164,user_id)")
      .eq("id", assignmentId)
      .maybeSingle();

    if (assignmentError) throw new Error(assignmentError.message);
    if (!assignment) {
      return NextResponse.json({ message: "لم يتم العثور على التكليف." }, { status: 404 });
    }

    const [{ data: platforms, error: platformError }, { data: compensations, error: compensationError }, { data: payments, error: paymentError }] = await Promise.all([
      admin
        .from("assignment_platforms")
        .select("id,required_deliverables,social_accounts(id,platform,username,profile_url),content_items(id,sequence_no,content_type,status,post_url,promo_code,submitted_at,approved_at,latest_version_id,publication_verified_at)")
        .eq("assignment_id", assignmentId)
        .order("created_at"),
      admin
        .from("assignment_compensations")
        .select("id,type,amount,voucher_source,voucher_branch,product_description,product_reference_value,expected_payment_at")
        .eq("assignment_id", assignmentId)
        .order("created_at"),
      admin
        .from("payments")
        .select("id,type,status,expected_amount,paid_amount,due_at,paid_at")
        .eq("assignment_id", assignmentId)
        .order("created_at"),
    ]);

    if (platformError) throw new Error(platformError.message);
    if (compensationError) throw new Error(compensationError.message);
    if (paymentError) throw new Error(paymentError.message);

    const platformRows = (platforms ?? []) as unknown as GuestPlatformRow[];
    const contentItems = platformRows.flatMap((platform) => platform.content_items ?? []);
    const contentIds = contentItems.map((item) => item.id);

    const [{ data: versions, error: versionsError }, { data: reviews, error: reviewsError }, { data: publications, error: publicationsError }] = await Promise.all([
      contentIds.length
        ? admin
            .from("content_versions")
            .select("id,content_item_id,version_no,file_path,external_url,original_filename,mime_type,file_size_bytes,notes,review_status,submitted_at")
            .in("content_item_id", contentIds)
            .order("version_no", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      contentIds.length
        ? admin
            .from("content_reviews")
            .select("id,content_item_id,decision,notes,created_at")
            .in("content_item_id", contentIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      contentIds.length
        ? admin
            .from("publication_submissions")
            .select("id,content_item_id,platform,post_url,published_at,screenshot_path,submitter_notes,status,review_notes,submitted_at,reviewed_at")
            .in("content_item_id", contentIds)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (versionsError) throw new Error(versionsError.message);
    if (reviewsError) throw new Error(reviewsError.message);
    if (publicationsError) throw new Error(publicationsError.message);

    const versionRows = (versions ?? []) as unknown as GuestVersionRow[];
    const reviewRows = (reviews ?? []) as unknown as GuestReviewRow[];
    const publicationRows = (publications ?? []) as unknown as GuestPublicationRow[];
    const signedVersionUrls = new Map<string, string | null>();
    const signedPublicationUrls = new Map<string, string | null>();

    await Promise.all([
      ...versionRows.map(async (version) => {
        if (!version.file_path) return;
        const { data } = await admin.storage.from("campaign-content").createSignedUrl(version.file_path, 60 * 60);
        signedVersionUrls.set(version.id, data?.signedUrl ?? null);
      }),
      ...publicationRows.map(async (publication) => {
        if (!publication.screenshot_path) return;
        const { data } = await admin.storage.from("publication-proofs").createSignedUrl(publication.screenshot_path, 60 * 60);
        signedPublicationUrls.set(publication.id, data?.signedUrl ?? null);
      }),
    ]);

    const versionsByContent = new Map<string, Array<Record<string, unknown>>>();
    for (const version of versionRows) {
      const list = versionsByContent.get(version.content_item_id) ?? [];
      list.push({
        ...version,
        fileUrl: signedVersionUrls.get(version.id) ?? null,
        file_path: undefined,
      });
      versionsByContent.set(version.content_item_id, list);
    }

    const reviewsByContent = new Map<string, Array<Record<string, unknown>>>();
    for (const review of reviewRows) {
      const list = reviewsByContent.get(review.content_item_id) ?? [];
      list.push(review);
      reviewsByContent.set(review.content_item_id, list);
    }

    const publicationsByContent = new Map<string, Array<Record<string, unknown>>>();
    for (const publication of publicationRows) {
      const list = publicationsByContent.get(publication.content_item_id) ?? [];
      list.push({
        ...publication,
        screenshotUrl: signedPublicationUrls.get(publication.id) ?? null,
        screenshot_path: undefined,
      });
      publicationsByContent.set(publication.content_item_id, list);
    }

    const platformDto = platformRows.map((platform) => ({
      id: platform.id,
      requiredDeliverables: platform.required_deliverables,
      socialAccount: platform.social_accounts,
      contentItems: (platform.content_items ?? []).map((item) => ({
        ...item,
        versions: versionsByContent.get(item.id) ?? [],
        reviews: reviewsByContent.get(item.id) ?? [],
        publications: publicationsByContent.get(item.id) ?? [],
      })),
    }));

    const compensationRows = (compensations ?? []) as Array<{ type: string }>;
    const hasBankTransfer = compensationRows.some((item) => item.type === "bank_transfer");
    const influencerRelation = assignment.influencers as unknown as {
      id: string;
      user_id: string | null;
    } | null;

    let bankProfileStatus = "incomplete";
    let bankConfirmedAt: string | null = null;

    if (hasBankTransfer && influencerRelation?.id) {
      const { data: financialProfile, error: financialError } = await admin
        .from("influencer_financial_profiles")
        .select("bank_profile_status,influencer_confirmed_at")
        .eq("influencer_id", influencerRelation.id)
        .maybeSingle();

      if (financialError) throw new Error(financialError.message);
      bankProfileStatus = financialProfile?.bank_profile_status ?? "incomplete";
      bankConfirmedAt = financialProfile?.influencer_confirmed_at ?? null;
    }

    const hasSubmittedPublication = publicationRows.length > 0;
    const hasAccount = Boolean(influencerRelation?.user_id);
    const paymentAccount = {
      required: hasBankTransfer,
      hasAccount,
      hasSubmittedPublication,
      bankProfileStatus,
      bankConfirmed: Boolean(bankConfirmedAt),
      shouldPrompt:
        hasBankTransfer &&
        hasSubmittedPublication &&
        (!hasAccount || bankProfileStatus !== "approved" || !bankConfirmedAt),
      completionPath: hasAccount
        ? `/portal/complete-account?token=${encodeURIComponent(token)}`
        : `/portal/activate-account?token=${encodeURIComponent(token)}`,
    };

    return NextResponse.json({
      success: true,
      assignment: {
        ...assignment,
        platforms: platformDto,
        compensations: compensations ?? [],
        payments: payments ?? [],
        paymentAccount,
      },
    });
  } catch (error) {
    console.error("Guest assignment load failed:", error);
    return NextResponse.json({ message: "تعذر تحميل بيانات التكليف حاليًا." }, { status: 500 });
  }
}
