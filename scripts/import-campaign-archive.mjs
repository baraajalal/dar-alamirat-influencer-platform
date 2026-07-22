import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;
const CAMPAIGNS_TABLE_ID = process.env.SMARTSUITE_CAMPAIGNS_TABLE_ID;
const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;

const ARCHIVE_FILE = path.join(process.cwd(), "data", "archive.xlsx");

const CAMPAIGNS_SHEET = "02_Campaigns";
const CAMPAIGN_INFLUENCERS_SHEET = "03_Campaign_Influencers";

function cleanValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (text === "0") return "";
  return text;
}

function normalizeText(value) {
  return cleanValue(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeMobile(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim();
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

function todayDate() {
  const today = new Date().toISOString().split("T")[0];

  return {
    date: `${today}T00:00:00.000000Z`,
    include_time: false,
  };
}

function getPaymentTypeIds(value) {
  const text = normalizeText(value);

  if (!text) return [];

  if (text.includes("bank") || text.includes("transfer") || text.includes("تحويل")) {
    return ["Cskhn"];
  }

  if (text.includes("voucher") || text.includes("قسيم")) {
    return ["ObVPO"];
  }

  if (text.includes("product") || text.includes("منتج")) {
    return ["7nWjo"];
  }

  if (text.includes("commission") || text.includes("عمول")) {
    return ["DyoCW"];
  }

  return ["FSjcg"];
}

function getCollaborationStatus(value) {
  const text = normalizeText(value);

  if (!text) return "mkBlA"; // Approved default

  if (text.includes("approved") || text.includes("موافق")) return "mkBlA";
  if (text.includes("rejected") || text.includes("مرفوض")) return "MDC3A";
  if (text.includes("complete") || text.includes("مكتمل")) return "8g720";
  if (text.includes("brief")) return "4cHxM";
  if (text.includes("product")) return "PNZY3";
  if (text.includes("published") || text.includes("نشر")) return "NQAqe";
  if (text.includes("payment")) return "2wwDC";
  if (text.includes("closed") || text.includes("مغلق")) return "4UcYP";

  return "mkBlA";
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

function readSheet(sheetName) {
  if (!fs.existsSync(ARCHIVE_FILE)) {
    throw new Error(`Archive file not found: ${ARCHIVE_FILE}`);
  }

  const workbook = XLSX.readFile(ARCHIVE_FILE);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.log(`Sheet not found: ${sheetName}`);
    return [];
  }

  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

function findCampaignByName(campaigns, campaignName) {
  const target = normalizeText(campaignName);

  return campaigns.find((record) => {
    const name = normalizeText(record.s53c807f15 || record.title || "");
    return name === target;
  });
}

function findInfluencerByMobile(influencers, mobile) {
  const target = normalizeMobile(mobile);

  return influencers.find((record) => {
    const recordMobile = normalizeMobile(record.se22f3e19b || "");
    return recordMobile === target;
  });
}

function findCampaignInfluencer(records, campaignName, mobile, platform) {
  const targetCampaign = normalizeText(campaignName);
  const targetMobile = normalizeMobile(mobile);
  const targetPlatform = normalizeText(platform);

  return records.find((record) => {
    const recordCampaign = normalizeText(record.s590fc77ca || "");
    const recordMobile = normalizeMobile(record.sdaf7872a0 || "");
    const recordPlatformText = normalizeText(record.Platform || record.platform || "");

    // لأن جدول Campaign Influencers ما عنده Platform field واضح من API،
    // نعتمد على Campaign Name + Mobile كحد أدنى لمنع التكرار.
    // إذا أضفنا Platform لاحقًا كحقل رسمي، نطوره.
    return recordCampaign === targetCampaign && recordMobile === targetMobile;
  });
}

function buildCampaignPayload(row, isCreate) {
  const campaignName = cleanValue(row["Campaign Name"]);

const payload = {
  title: campaignName,

  // Campaign Name
  s53c807f15: campaignName,

  // Brand
  s3fa372904: cleanValue(row.Brand),

  // Product
  s3869eb683: cleanValue(row.Product),

  // Budget
  sa48d99210: cleanValue(row.Budget),

  // Target City
  sbc04c4250: cleanValue(row["Target City"]),

  // Campaign Manager
  sba730f59b: cleanValue(row["Campaign Manager"]),

  // Brief / Notes
  s97c8d3f53: cleanValue(row.Brief || row.Notes),

  // Campaign Objective - Required
  // HEsuV = Brand Awareness
  s9897d613e: ["HEsuV"],

  // Last Updated Date
  s83d15330a: todayDate(),
};
  const startDate = dateValue(row["Start Date"]);
  const endDate = dateValue(row["End Date"]);

  if (startDate) payload.s1889ebf16 = startDate;
  if (endDate) payload.s415b6fd8d = endDate;

  if (isCreate) {
    payload.s0230230dc = todayDate();
  }

  return payload;
}

function getInfluencerTypeFromMawthooq(influencerRecord) {
  const hasMawthooq = influencerRecord?.scd2b75e3b;

  // Has Mawthooq = Yes
  if (hasMawthooq === "OgXe2") {
    return ["sJgBl"]; // Trusted
  }

  // Has Mawthooq = No
  if (hasMawthooq === "RpV6I") {
    return ["zZE8m"]; // Untrusted
  }

  return ["Y5vrc"]; // Under Review
}


function buildCampaignInfluencerPayload({
  row,
  campaignRecord,
  influencerRecord,
  campaignName,
  mobile,
}) {
  const campaignRecordId = campaignRecord.id || campaignRecord.record_id;
  const influencerRecordId =
    influencerRecord?.id || influencerRecord?.record_id || "";

  const influencerName =
    cleanValue(row["Influencer Name"]) ||
    influencerRecord?.s8a2442cdf?.sys_root ||
    influencerRecord?.s8a2442cdf?.first_name ||
    "";

  const title = `${campaignName} - ${mobile}`;

  const payload = {
    title,

    // Campaign linked record
    s01944895f: campaignRecordId ? [campaignRecordId] : [],

    // Campaign Name text
    s590fc77ca: campaignName,

    // Influencer linked record
    s85138512a: influencerRecordId ? [influencerRecordId] : [],

    // Influencer Name
    scc4243592: influencerName,

    // Influencer Type - based on Has Mawthooq
    s4ca700cd4: getInfluencerTypeFromMawthooq(influencerRecord),

    // Brief Sent? - Required
    // iDp2F = No
    s4a83b4d1a: "iDp2F",
    // Record Source - Archive
    sac3648c3c: "caOKg",
    // Mobile search
    sdaf7872a0: mobile,

    // Payment Type
    sf6fbe2681: getPaymentTypeIds(row["Payment Type"]),

    // Agreed Amount
    seb3ddba13: cleanValue(row["Agreed Amount"]),

    // Voucher Value
    se72f3a482: cleanValue(row["Voucher Value"]),

    // Product Value
    s5ce29698a: cleanValue(row["Product Value"]),

    // Published Link
    sbb87657da: cleanValue(row["Published Link"]),

    // Last Updated Date
    s153a28310: todayDate(),

    // Collaboration Status
    status: {
      value: getCollaborationStatus(row["Collaboration Status"]),
    },
  };

  return payload;
}

async function main() {
  console.log("Reading campaign archive...");

  const campaignRows = readSheet(CAMPAIGNS_SHEET);
  const campaignInfluencerRows = readSheet(CAMPAIGN_INFLUENCERS_SHEET);

  console.log(`Campaign rows: ${campaignRows.length}`);
  console.log(`Campaign influencer rows: ${campaignInfluencerRows.length}`);

  if (!CAMPAIGNS_TABLE_ID) throw new Error("Missing SMARTSUITE_CAMPAIGNS_TABLE_ID");
  if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID");
  }
  if (!INFLUENCERS_TABLE_ID) throw new Error("Missing SMARTSUITE_INFLUENCERS_TABLE_ID");

  console.log("Loading existing records...");

  let campaigns = await listRecords(CAMPAIGNS_TABLE_ID);
  const influencers = await listRecords(INFLUENCERS_TABLE_ID);
  let campaignInfluencers = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);

  const stats = {
    campaignsCreated: 0,
    campaignsUpdated: 0,
    campaignInfluencersCreated: 0,
    campaignInfluencersUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  console.log("Importing campaigns...");

  for (const [index, row] of campaignRows.entries()) {
    const rowNumber = index + 2;
    const campaignName = cleanValue(row["Campaign Name"]);

    if (!campaignName) {
      stats.skipped++;
      console.log(`Campaign row ${rowNumber}: skipped, missing Campaign Name`);
      continue;
    }

    try {
      const existing = findCampaignByName(campaigns, campaignName);

      if (existing) {
        const recordId = existing.id || existing.record_id;

        await updateRecord(
          CAMPAIGNS_TABLE_ID,
          recordId,
          buildCampaignPayload(row, false)
        );

        stats.campaignsUpdated++;
        console.log(`Campaign row ${rowNumber}: updated ${campaignName}`);
      } else {
        const created = await createRecord(
          CAMPAIGNS_TABLE_ID,
          buildCampaignPayload(row, true)
        );

        const recordId = created.id || created.record_id;

        campaigns.push({
          ...created,
          id: recordId,
          s53c807f15: campaignName,
          title: campaignName,
        });

        stats.campaignsCreated++;
        console.log(`Campaign row ${rowNumber}: created ${campaignName}`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`Campaign row ${rowNumber}: failed`, error.message);
    }
  }

  console.log("Importing campaign influencers...");

  for (const [index, row] of campaignInfluencerRows.entries()) {
    const rowNumber = index + 2;
    const campaignName = cleanValue(row["Campaign Name"]);
    const mobile = normalizeMobile(row.Mobile);

    if (!campaignName || !mobile) {
      stats.skipped++;
      console.log(
        `Campaign Influencer row ${rowNumber}: skipped, missing Campaign Name or Mobile`
      );
      continue;
    }

    try {
      const campaign = findCampaignByName(campaigns, campaignName);

      if (!campaign) {
        stats.skipped++;
        console.log(
          `Campaign Influencer row ${rowNumber}: skipped, campaign not found: ${campaignName}`
        );
        continue;
      }

      const influencer = findInfluencerByMobile(influencers, mobile);

      if (!influencer) {
        stats.skipped++;
        console.log(
          `Campaign Influencer row ${rowNumber}: skipped, influencer not found: ${mobile}`
        );
        continue;
      }

      const existing = findCampaignInfluencer(
        campaignInfluencers,
        campaignName,
        mobile,
        row.Platform
      );

      const payload = buildCampaignInfluencerPayload({
        row,
        campaignRecord: campaign,
        influencerRecord: influencer,
        campaignName,
        mobile,
      });

      if (existing) {
        const recordId = existing.id || existing.record_id;

        await updateRecord(
          CAMPAIGN_INFLUENCERS_TABLE_ID,
          recordId,
          payload
        );

        stats.campaignInfluencersUpdated++;
        console.log(
          `Campaign Influencer row ${rowNumber}: updated ${campaignName} - ${mobile}`
        );
      } else {
        const created = await createRecord(
          CAMPAIGN_INFLUENCERS_TABLE_ID,
          {
            ...payload,
            s058cfa307: todayDate(),
          }
        );

        const recordId = created.id || created.record_id;

        campaignInfluencers.push({
          ...created,
          id: recordId,
          s590fc77ca: campaignName,
          sdaf7872a0: mobile,
        });

        stats.campaignInfluencersCreated++;
        console.log(
          `Campaign Influencer row ${rowNumber}: created ${campaignName} - ${mobile}`
        );
      }
    } catch (error) {
      stats.errors++;
      console.error(
        `Campaign Influencer row ${rowNumber}: failed`,
        error.message
      );
    }
  }

  console.log("");
  console.log("Campaign import finished.");
  console.log(stats);
}

main().catch((error) => {
  console.error("Campaign import failed:", error);
  process.exit(1);
});