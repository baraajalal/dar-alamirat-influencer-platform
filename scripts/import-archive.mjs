import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();
const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;
const SOCIAL_ACCOUNTS_TABLE_ID = process.env.SMARTSUITE_SOCIAL_ACCOUNTS_TABLE_ID;

const ARCHIVE_FILE = path.join(process.cwd(), "data", "archive.xlsx");
const SHEET_NAME = "01_Influencers_Social";

function normalizeMobile(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/\+/g, "")
    .replace(/-/g, "")
    .trim();
}

function cleanValue(value) {
  if (value === undefined || value === null) return "";
  const text = String(value).trim();
  if (text === "0") return "";
  return text;
}

function normalizeUrl(value) {
  const url = cleanValue(value);
  if (!url) return "";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function normalizePlatform(value) {
  const platform = cleanValue(value).toLowerCase();

  if (platform.includes("tiktok") || platform.includes("تيك")) return "TikTok";
  if (platform.includes("instagram") || platform.includes("انستا")) return "Instagram";
  if (platform.includes("snap") || platform.includes("سناب")) return "Snapchat";
  if (platform.includes("youtube") || platform.includes("يوتيوب")) return "YouTube";
  if (platform === "x" || platform.includes("twitter")) return "X";
  if (platform.includes("facebook")) return "Facebook";

  return "Other";
}

function getPlatformId(platform) {
  const map = {
    Instagram: "lewTg",
    TikTok: "fcPmm",
    Snapchat: "ignLA",
    YouTube: "Gbbgd",
    X: "jHhHD",
    Facebook: "vQc7l",
    Other: "UUtcJ",
  };

  return map[platform] ?? "UUtcJ";
}

function getPlatformName(platformValue) {
  const map = {
    lewTg: "Instagram",
    fcPmm: "TikTok",
    ignLA: "Snapchat",
    Gbbgd: "YouTube",
    jHhHD: "X",
    vQc7l: "Facebook",
    UUtcJ: "Other",
  };

  if (Array.isArray(platformValue)) {
    return map[platformValue[0]] || "";
  }

  return map[platformValue] || "";
}

function getMawthooqId(value) {
  const text = cleanValue(value).toLowerCase();

  if (["yes", "y", "true", "نعم", "ايوه", "أيوه"].includes(text)) {
    return "OgXe2";
  }

  if (["no", "n", "false", "لا"].includes(text)) {
    return "RpV6I";
  }

  return null;
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

function buildInfluencerPayload(row, isCreate) {
  const today = new Date().toISOString().split("T")[0];

  const mobile = normalizeMobile(row.Mobile);
  const fullName = cleanValue(row["Full Name"]) || cleanValue(row.FullName) || `مؤثر ${mobile}`;
  const hasMawthooq = getMawthooqId(row["Has Mawthooq"]);

  const payload = {
    title: `${fullName} - ${mobile}`,

    // Last Updated Date
    s3c70acbe8: {
      date: `${today}T00:00:00.000000Z`,
      include_time: false,
    },

    // Preferred Ad Categories - default Other
    s0c45386d9: ["EfLyW"],

    // Content Style Preference - default Reels
    s908cb5707: ["TrahD"],

    // Full Name
    s8a2442cdf: {
      first_name: fullName,
      middle_name: "",
      last_name: "",
    },

    // City
    s5498d745d: cleanValue(row.City),

    // Country
    s5f7a6d1b0: cleanValue(row.Country) || "Saudi Arabia",

    // National ID
    sdf5e7d6fa: cleanValue(row["National ID"]),

    // Has Mawthooq
    scd2b75e3b: hasMawthooq,

    // Bank Name
    s510a1c6cb: cleanValue(row["Bank Name"]),

    // IBAN
    s067f7fb0b: cleanValue(row.IBAN),

    // Account Holder Name
    s36be478d5: cleanValue(row["Account Holder Name"]),

    // Mawthooq Number
    sfd0838d52: cleanValue(row["Mawthooq Number"]),
  };

  if (isCreate) {
    // Mobile only on create to avoid unique conflict on update
    payload.se22f3e19b = mobile;

    // Created Date
    payload.sed8203cce = {
      date: `${today}T00:00:00.000000Z`,
      include_time: false,
    };
  }

  return payload;
}

function buildSocialPayload(row, influencerRecordId, fullName) {
  const platform = normalizePlatform(row.Platform);

  return {
    // Influencer ID
    sf702e7fac: influencerRecordId,

    // Influencer Name
    s2071e9c0b: fullName,

    // INF_Phone
    sfd995e159: normalizeMobile(row.Mobile),

    // Platform
    s6eb45309b: [getPlatformId(platform)],

    // Profile URL
    s0337da55a: normalizeUrl(row["Profile URL"]),

    // Username
    s2da4f29f5: cleanValue(row.Username),

    // Followers Count
    sd03185167: cleanValue(row["Followers Count"]),

    // Average View
    sc00535482: cleanValue(row["Average Views"]),

    // Average Likes
    s41ebd9627: cleanValue(row["Average Likes"]),

    // Average Comments
    s3a367ccb5: cleanValue(row["Average Comments"]),

    // Engagement Rate
    s3317459b2: cleanValue(row["Engagement Rate"]),

    // Female Audience %
    sb1b76358f: cleanValue(row["Female Audience %"]),

    // Male Audience %
    se9195b09e: cleanValue(row["Male Audience %"]),

    // Audience Main City
    s42f7bb236: cleanValue(row["Audience Main City"]),

    // Audience Main Country
    s3ad5a52db: cleanValue(row["Audience Main Country"]),

    // Last Checked Date
    sb90b7e360: {
      date: new Date().toISOString(),
      include_time: false,
    },
  };
}

function findInfluencerByMobile(records, mobile) {
  const normalized = normalizeMobile(mobile);

  return records.find((record) => {
    const recordMobile = normalizeMobile(record.se22f3e19b || "");
    return recordMobile === normalized;
  });
}

function findSocialByMobileAndPlatform(records, mobile, platform) {
  const normalized = normalizeMobile(mobile);
  const platformId = getPlatformId(platform);

  return records.find((record) => {
    const recordMobile = normalizeMobile(record.sfd995e159 || "");
    const recordPlatformName = getPlatformName(record.s6eb45309b);
    const recordPlatformId = getPlatformId(recordPlatformName);

    return recordMobile === normalized && recordPlatformId === platformId;
  });
}

function readArchiveRows() {
  if (!fs.existsSync(ARCHIVE_FILE)) {
    throw new Error(`Archive file not found: ${ARCHIVE_FILE}`);
  }

  const workbook = XLSX.readFile(ARCHIVE_FILE);
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new Error(`Sheet not found: ${SHEET_NAME}`);
  }

  return XLSX.utils.sheet_to_json(sheet, {
    defval: "",
  });
}

async function main() {
  console.log("Reading archive file...");
  const rows = readArchiveRows();

  console.log(`Rows found: ${rows.length}`);

  const validRows = rows.filter((row) => normalizeMobile(row.Mobile));

  console.log(`Valid rows with Mobile: ${validRows.length}`);

  if (validRows.length === 0) {
    console.log("No valid rows to import.");
    return;
  }

  console.log("Loading existing SmartSuite records...");
  let influencers = await listRecords(INFLUENCERS_TABLE_ID);
  let socialAccounts = await listRecords(SOCIAL_ACCOUNTS_TABLE_ID);

  const stats = {
    influencersCreated: 0,
    influencersUpdated: 0,
    socialCreated: 0,
    socialUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const [index, row] of validRows.entries()) {
    const rowNumber = index + 2;
    const mobile = normalizeMobile(row.Mobile);
    const platform = normalizePlatform(row.Platform);
    const fullName =
      cleanValue(row["Full Name"]) || cleanValue(row.FullName) || `مؤثر ${mobile}`;

    if (!mobile || !platform) {
      stats.skipped++;
      console.log(`Row ${rowNumber}: skipped, missing mobile or platform`);
      continue;
    }

    try {
      let influencer = findInfluencerByMobile(influencers, mobile);
      let influencerRecordId = "";

      if (influencer) {
        influencerRecordId = influencer.id || influencer.record_id;

        await updateRecord(
          INFLUENCERS_TABLE_ID,
          influencerRecordId,
          buildInfluencerPayload(row, false)
        );

        stats.influencersUpdated++;
        console.log(`Row ${rowNumber}: updated influencer ${mobile}`);
      } else {
        const created = await createRecord(
          INFLUENCERS_TABLE_ID,
          buildInfluencerPayload(row, true)
        );

        influencerRecordId = created.id || created.record_id;
        stats.influencersCreated++;

        influencers.push({
          ...created,
          id: influencerRecordId,
          se22f3e19b: mobile,
        });

        console.log(`Row ${rowNumber}: created influencer ${mobile}`);
      }

      const existingSocial = findSocialByMobileAndPlatform(
        socialAccounts,
        mobile,
        platform
      );

      const socialPayload = buildSocialPayload(row, influencerRecordId, fullName);

      if (existingSocial) {
        const socialRecordId = existingSocial.id || existingSocial.record_id;

        await updateRecord(
          SOCIAL_ACCOUNTS_TABLE_ID,
          socialRecordId,
          socialPayload
        );

        stats.socialUpdated++;
        console.log(`Row ${rowNumber}: updated ${platform} for ${mobile}`);
      } else {
        const createdSocial = await createRecord(
          SOCIAL_ACCOUNTS_TABLE_ID,
          socialPayload
        );

        const socialRecordId = createdSocial.id || createdSocial.record_id;

        socialAccounts.push({
          ...createdSocial,
          id: socialRecordId,
          sfd995e159: mobile,
          s6eb45309b: [getPlatformId(platform)],
        });

        stats.socialCreated++;
        console.log(`Row ${rowNumber}: created ${platform} for ${mobile}`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`Row ${rowNumber}: failed`, error.message);
    }
  }

  console.log("");
  console.log("Import finished.");
  console.log(stats);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});