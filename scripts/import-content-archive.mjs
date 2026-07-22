import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;
const CONTENT_LIBRARY_TABLE_ID =
  process.env.SMARTSUITE_CONTENT_LIBRARY_TABLE_ID;

const ARCHIVE_FILE = path.join(process.cwd(), "data", "archive.xlsx");
const SOURCE_SHEET = "04_Content";

function cleanValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (text === "0") return "";
  return text;
}

function normalizeText(value) {
  return cleanValue(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim();
}

function normalizeUrl(value) {
  const url = cleanValue(value);
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

function dateValue(value) {
  const text = cleanValue(value);
  if (!text) return null;

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;

  return {
    date: date.toISOString(),
    include_time: false,
  };
}

function getPlatformId(platform) {
  const text = normalizeText(platform);

  if (text.includes("instagram") || text.includes("انستا")) return "rm2Kv";
  if (text.includes("tiktok") || text.includes("تيك")) return "pIVAt";
  if (text.includes("snap") || text.includes("سناب")) return "O7XK5";
  if (text.includes("youtube") || text.includes("يوتيوب")) return "cVjpu";
  if (text === "x" || text.includes("twitter")) return "okw05";
  if (text.includes("facebook")) return "PcGwd";

  return "cI7TX";
}

function getContentTypeId(value, platform) {
  const text = normalizeText(value);
  const platformText = normalizeText(platform);

  if (text.includes("reel")) return "aDwiB";
  if (text.includes("story") || text.includes("ستوري")) return "TnQ7W";
  if (text.includes("post") || text.includes("بوست")) return "f8pcO";
  if (text.includes("snap")) return "qMbzF";
  if (text.includes("tiktok") || platformText.includes("tiktok")) return "FDKXO";
  if (text.includes("youtube")) return "BECXx";
  if (text.includes("live")) return "U2TvZ";
  if (text.includes("photo") || text.includes("صورة")) return "YCdyY";
  if (text.includes("video") || text.includes("فيديو")) return "p6uac";

  return "gsSYT";
}

async function smartSuiteRequest(url, options) {
  if (!API_KEY) throw new Error("Missing SMARTSUITE_API_KEY");
  if (!ACCOUNT_ID) throw new Error("Missing SMARTSUITE_ACCOUNT_ID");

  const response = await fetch(url, {
    method: options.method,
    headers: {
      Authorization: `Token ${API_KEY}`,
      "ACCOUNT-ID": ACCOUNT_ID,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();

  let result = {};
  try {
    result = text ? JSON.parse(text) : {};
  } catch {
    console.error("SmartSuite non-JSON response:", text);
    throw new Error("SmartSuite returned non-JSON response");
  }

  if (!response.ok) {
    console.error("SmartSuite API Error:", JSON.stringify(result, null, 2));
    throw new Error(JSON.stringify(result));
  }

  return result;
}

async function listRecords(tableId) {
  const result = await smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/list/`,
    {
      method: "POST",
      body: { limit: 1000 },
    }
  );

  return result.items || result.results || result.records || [];
}

async function createRecord(tableId, data) {
  return smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/`,
    {
      method: "POST",
      body: data,
    }
  );
}

async function updateRecord(tableId, recordId, data) {
  return smartSuiteRequest(
    `${SMARTSUITE_API_URL}/applications/${tableId}/records/${recordId}/`,
    {
      method: "PATCH",
      body: data,
    }
  );
}

function readRows() {
  if (!fs.existsSync(ARCHIVE_FILE)) {
    throw new Error(`Archive file not found: ${ARCHIVE_FILE}`);
  }

  const workbook = XLSX.readFile(ARCHIVE_FILE);
  const sheet = workbook.Sheets[SOURCE_SHEET];

  if (!sheet) {
    throw new Error(`Sheet not found: ${SOURCE_SHEET}`);
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function findCampaignInfluencer(records, campaignName, mobile) {
  const targetCampaign = normalizeText(campaignName);
  const targetMobile = normalizeMobile(mobile);

  return records.find((record) => {
    const recordCampaign = normalizeText(record.s590fc77ca || "");
    const recordMobile = normalizeMobile(record.sdaf7872a0 || "");

    return recordCampaign === targetCampaign && recordMobile === targetMobile;
  });
}

function findContentByPostLink(records, link) {
  const targetLink = normalizeUrl(link);

  if (!targetLink) return null;

  return records.find((record) => {
    const postLinks = Array.isArray(record.s4203b3432)
      ? record.s4203b3432
      : [];

    const contentLink = cleanValue(record.s5364f427e);

    return (
      postLinks.some((item) => normalizeUrl(item) === targetLink) ||
      normalizeUrl(contentLink) === targetLink
    );
  });
}

function buildContentPayload({ row, campaignInfluencerRecord }) {
  const campaignInfluencerId =
    campaignInfluencerRecord?.id || campaignInfluencerRecord?.record_id || "";

  const campaignName = cleanValue(row["Campaign Name"]);
  const mobile = normalizeMobile(row.Mobile);
  const platform = cleanValue(row.Platform);
  const publishedLink = normalizeUrl(
    row["Published Link"] || row["Post Link"] || row["Content Link"]
  );

  const influencerName =
    cleanValue(row["Influencer Name"]) ||
    cleanValue(campaignInfluencerRecord?.scc4243592);

  const title = `${campaignName} - ${mobile} - Content`;

  const contentDate =
    dateValue(row["Publishing Date"]) ||
    dateValue(row.Date) ||
    dateValue(row["Post Date"]);

  const notes = [
    cleanValue(row.Notes),
    cleanValue(row.Views) ? `Views: ${cleanValue(row.Views)}` : "",
    cleanValue(row.Likes) ? `Likes: ${cleanValue(row.Likes)}` : "",
    cleanValue(row.Comments) ? `Comments: ${cleanValue(row.Comments)}` : "",
    cleanValue(row["Engagement Rate"])
      ? `Engagement Rate: ${cleanValue(row["Engagement Rate"])}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const payload = {
    title,

    // Campaign Influencer linked record
    s6476e8770: campaignInfluencerId ? [campaignInfluencerId] : [],

    // Campaign Name
    sf6e066e15: campaignName,

    // Influencer Name
    s65c64900d: influencerName,

    // Platform
    s2ef379dbe: [getPlatformId(platform)],

    // Content Type
    sac21f5178: [getContentTypeId(row["Content Type"], platform)],

    // Content Status - Archived
    s9727fc2c7: ["JCpRg"],

    // Content Link
    s5364f427e: publishedLink,

    // Post Link
    s4203b3432: publishedLink ? [publishedLink] : [],

    // Approval Status - Approved
    s8adf35d78: ["bPaKV"],

    // Last Updated Date
    s68059f011: todayDate(),
  };

  if (contentDate) {
    payload.s981a45b97 = contentDate;
  }

  if (notes) {
    payload.description = {
      data: {
        type: "doc",
        content: [],
      },
      html: `<div class="rendered">${notes.replace(/\n/g, "<br>")}</div>`,
      preview: notes.slice(0, 500),
    };
  }

  return payload;
}

async function main() {
  console.log("Reading content archive...");

  const rows = readRows();

  console.log(`Rows found: ${rows.length}`);

  const validRows = rows.filter((row) => {
    const campaignName = cleanValue(row["Campaign Name"]);
    const mobile = normalizeMobile(row.Mobile);
    const link = cleanValue(
      row["Published Link"] || row["Post Link"] || row["Content Link"]
    );

    return campaignName && mobile && link;
  });

  console.log(`Valid rows: ${validRows.length}`);

  if (!CONTENT_LIBRARY_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_CONTENT_LIBRARY_TABLE_ID");
  }

  if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID");
  }

  console.log("Loading existing records...");

  const campaignInfluencers = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);
  let contentRecords = await listRecords(CONTENT_LIBRARY_TABLE_ID);

  const stats = {
    contentCreated: 0,
    contentUpdated: 0,
    skippedMissingCampaignInfluencer: 0,
    skippedMissingRequiredData: 0,
    errors: 0,
  };

  for (const [index, row] of validRows.entries()) {
    const rowNumber = index + 2;
    const campaignName = cleanValue(row["Campaign Name"]);
    const mobile = normalizeMobile(row.Mobile);
    const link = cleanValue(
      row["Published Link"] || row["Post Link"] || row["Content Link"]
    );

    try {
      const campaignInfluencer = findCampaignInfluencer(
        campaignInfluencers,
        campaignName,
        mobile
      );

      if (!campaignInfluencer) {
        stats.skippedMissingCampaignInfluencer++;
        console.log(
          `Row ${rowNumber}: skipped, campaign influencer not found: ${campaignName} - ${mobile}`
        );
        continue;
      }

      const existingContent = findContentByPostLink(contentRecords, link);

      const payload = buildContentPayload({
        row,
        campaignInfluencerRecord: campaignInfluencer,
      });

      if (existingContent) {
        const recordId = existingContent.id || existingContent.record_id;

        await updateRecord(CONTENT_LIBRARY_TABLE_ID, recordId, payload);

        stats.contentUpdated++;
        console.log(`Row ${rowNumber}: updated content ${link}`);
      } else {
        const created = await createRecord(CONTENT_LIBRARY_TABLE_ID, {
          ...payload,
          s8d0592f7a: todayDate(),
        });

        const recordId = created.id || created.record_id;

        contentRecords.push({
          ...created,
          id: recordId,
          s4203b3432: [normalizeUrl(link)],
          s5364f427e: normalizeUrl(link),
        });

        stats.contentCreated++;
        console.log(`Row ${rowNumber}: created content ${link}`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`Row ${rowNumber}: failed`, error.message);
    }
  }

  console.log("");
  console.log("Content import finished.");
  console.log(stats);
}

main().catch((error) => {
  console.error("Content import failed:", error);
  process.exit(1);
});