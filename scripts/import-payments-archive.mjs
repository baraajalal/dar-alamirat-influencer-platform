import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const SMARTSUITE_API_URL = "https://app.smartsuite.com/api/v1";

const API_KEY = process.env.SMARTSUITE_API_KEY?.trim();
const ACCOUNT_ID = process.env.SMARTSUITE_ACCOUNT_ID?.trim();

const INFLUENCERS_TABLE_ID = process.env.SMARTSUITE_INFLUENCERS_TABLE_ID;
const CAMPAIGN_INFLUENCERS_TABLE_ID =
  process.env.SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID;
const PAYMENTS_TABLE_ID = process.env.SMARTSUITE_PAYMENTS_TABLE_ID;

const ARCHIVE_FILE = path.join(process.cwd(), "data", "archive.xlsx");
const SOURCE_SHEET = "03_Campaign_Influencers";

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

function hasPaymentData(row) {
  return Boolean(
    cleanValue(row["Payment Type"]) ||
      cleanValue(row["Agreed Amount"]) ||
      cleanValue(row["Voucher Value"]) ||
      cleanValue(row["Product Value"])
  );
}

function getPaymentTypeText(row) {
  const paymentType = normalizeText(row["Payment Type"]);

  if (paymentType.includes("bank") || paymentType.includes("transfer") || paymentType.includes("تحويل")) {
    return "Bank Transfer";
  }

  if (paymentType.includes("voucher") || paymentType.includes("قسيم")) {
    return "Voucher";
  }

  if (paymentType.includes("product") || paymentType.includes("منتج")) {
    return "Product";
  }

  if (paymentType.includes("commission") || paymentType.includes("عمول")) {
    return "Commission";
  }

  if (cleanValue(row["Agreed Amount"])) {
    return "Bank Transfer";
  }

  if (cleanValue(row["Voucher Value"])) {
    return "Voucher";
  }

  if (cleanValue(row["Product Value"])) {
    return "Product";
  }

  return "Other";
}

function getInfluencerTypeText(influencerRecord) {
  const hasMawthooq = influencerRecord?.scd2b75e3b;

  if (hasMawthooq === "OgXe2") return "Trusted";
  if (hasMawthooq === "RpV6I") return "Untrusted";

  return "Under Review";
}

function getFullName(record) {
  const fullName = record?.s8a2442cdf;

  if (!fullName) return "";

  if (typeof fullName === "string") return fullName;

  if (fullName.sys_root) return fullName.sys_root;

  return [fullName.first_name, fullName.middle_name, fullName.last_name]
    .filter(Boolean)
    .join(" ");
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

function findInfluencerByMobile(influencers, mobile) {
  const target = normalizeMobile(mobile);

  return influencers.find((record) => {
    const recordMobile = normalizeMobile(record.se22f3e19b || "");
    return recordMobile === target;
  });
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

function findPayment(payments, campaignName, mobile, paymentType) {
  const targetCampaign = normalizeText(campaignName);
  const targetMobile = normalizeMobile(mobile);
  const targetPaymentType = normalizeText(paymentType);

  return payments.find((record) => {
    const recordCampaign = normalizeText(record.sa1654cad3 || "");
    const recordPaymentType = normalizeText(record.sb6b0099cb || "");
    const title = normalizeText(record.title || "");

    return (
      recordCampaign === targetCampaign &&
      title.includes(targetMobile) &&
      recordPaymentType === targetPaymentType
    );
  });
}

function buildPaymentPayload({
  row,
  campaignInfluencerRecord,
  influencerRecord,
  campaignName,
  mobile,
}) {
  const campaignInfluencerRecordId =
    campaignInfluencerRecord?.id || campaignInfluencerRecord?.record_id || "";

  const influencerRecordId =
    influencerRecord?.id || influencerRecord?.record_id || "";

  const influencerName =
    cleanValue(row["Influencer Name"]) || getFullName(influencerRecord);

  const paymentType = getPaymentTypeText(row);

  const title = `${campaignName} - ${mobile} - ${paymentType}`;

  const paidDate = dateValue(row["Paid Date"]);

  const payload = {
    title,

    // Campaign Influencer linked record
    s55faf09aa: campaignInfluencerRecordId ? [campaignInfluencerRecordId] : [],

    // Campaign Name
    sa1654cad3: campaignName,

    // Influencer Name
    s687ecf684: influencerName,

    // Influencer Type
    s3e3506c2b: getInfluencerTypeText(influencerRecord),

    // Payment Type
    sb6b0099cb: paymentType,

    // Agreed Amount
    s21c247bb2: cleanValue(row["Agreed Amount"]),

    // Voucher Value
    s81aa1999e: cleanValue(row["Voucher Value"]),

    // Product Value
    s6091f3df9: cleanValue(row["Product Value"]),

    // Bank Name
    s4a71c5551: cleanValue(influencerRecord?.s510a1c6cb),

    // IBAN
    s410fa372a: cleanValue(influencerRecord?.s067f7fb0b),

    // Account Holder Name
    s07d531627: cleanValue(influencerRecord?.s36be478d5),

    // National ID
    sa51914e57: cleanValue(influencerRecord?.sdf5e7d6fa),

    // Post Link
    s8a401e43b: cleanValue(row["Published Link"]),

    // Payment Approval Status
    sf60af4c84: "Approved - Archive",

    // Finance Batch Number
    seee344772: cleanValue(row["Finance Batch Number"]),

    // Payment Status - Paid
    sc5f22146c: ["cQLKE"],

    // Influencer linked record
    s6c51cc843: influencerRecordId ? [influencerRecordId] : [],

    // Record Source - Archive
    sc93f1010d: "hMufn",

    // Notes / Text Area
    s48364d932: cleanValue(row.Notes) || "Imported from archive",
  };

  if (paidDate) {
    payload.sa7e6743a1 = paidDate;
  }

  return payload;
}

async function main() {
  console.log("Reading payment archive from Campaign Influencers sheet...");

  const rows = readRows();

  console.log(`Rows found: ${rows.length}`);

  const validRows = rows.filter((row) => {
    return cleanValue(row["Campaign Name"]) && normalizeMobile(row.Mobile);
  });

  console.log(`Valid rows: ${validRows.length}`);

  if (!PAYMENTS_TABLE_ID) throw new Error("Missing SMARTSUITE_PAYMENTS_TABLE_ID");
  if (!CAMPAIGN_INFLUENCERS_TABLE_ID) {
    throw new Error("Missing SMARTSUITE_CAMPAIGN_INFLUENCERS_TABLE_ID");
  }
  if (!INFLUENCERS_TABLE_ID) throw new Error("Missing SMARTSUITE_INFLUENCERS_TABLE_ID");

  console.log("Loading existing records...");

  const influencers = await listRecords(INFLUENCERS_TABLE_ID);
  const campaignInfluencers = await listRecords(CAMPAIGN_INFLUENCERS_TABLE_ID);
  let payments = await listRecords(PAYMENTS_TABLE_ID);

  const stats = {
    paymentsCreated: 0,
    paymentsUpdated: 0,
    skippedNoPaymentData: 0,
    skippedMissingCampaignInfluencer: 0,
    skippedMissingInfluencer: 0,
    errors: 0,
  };

  for (const [index, row] of validRows.entries()) {
    const rowNumber = index + 2;
    const campaignName = cleanValue(row["Campaign Name"]);
    const mobile = normalizeMobile(row.Mobile);

    if (!hasPaymentData(row)) {
      stats.skippedNoPaymentData++;
      console.log(`Row ${rowNumber}: skipped, no payment data`);
      continue;
    }

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

      const influencer = findInfluencerByMobile(influencers, mobile);

      if (!influencer) {
        stats.skippedMissingInfluencer++;
        console.log(`Row ${rowNumber}: skipped, influencer not found: ${mobile}`);
        continue;
      }

      const paymentType = getPaymentTypeText(row);
      const existingPayment = findPayment(
        payments,
        campaignName,
        mobile,
        paymentType
      );

      const payload = buildPaymentPayload({
        row,
        campaignInfluencerRecord: campaignInfluencer,
        influencerRecord: influencer,
        campaignName,
        mobile,
      });

      if (existingPayment) {
        const recordId = existingPayment.id || existingPayment.record_id;

        await updateRecord(PAYMENTS_TABLE_ID, recordId, payload);

        stats.paymentsUpdated++;
        console.log(`Row ${rowNumber}: updated payment ${campaignName} - ${mobile}`);
      } else {
        const created = await createRecord(PAYMENTS_TABLE_ID, payload);
        const recordId = created.id || created.record_id;

        payments.push({
          ...created,
          id: recordId,
          title: payload.title,
          sa1654cad3: campaignName,
          sb6b0099cb: paymentType,
        });

        stats.paymentsCreated++;
        console.log(`Row ${rowNumber}: created payment ${campaignName} - ${mobile}`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`Row ${rowNumber}: failed`, error.message);
    }
  }

  console.log("");
  console.log("Payments import finished.");
  console.log(stats);
}

main().catch((error) => {
  console.error("Payments import failed:", error);
  process.exit(1);
});