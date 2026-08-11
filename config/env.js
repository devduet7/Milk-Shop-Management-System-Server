// <== IMPORTS ==>
import dotenv from "dotenv";

// <== LOADING ENVIRONMENT VARIABLES ==>
dotenv.config();

// <== DURATION STRING PATTERN ==>
const DURATION_PATTERN = /^\d+\s*(m|h|d)$/i;

// <== EMAIL PATTERN ==>
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// <== MONGO CONNECTION STRING PATTERN ==>
const MONGO_URI_PATTERN = /^mongodb(\+srv)?:\/\//i;

// <== ENVIRONMENT VARIABLE SCHEMA ==>
const envSchema = [
  {
    key: "NODE_ENV",
    type: "enum",
    options: ["development", "production", "test"],
    default: "development",
  },
  { key: "PORT", type: "number", default: "3000" },
  { key: "API_KEY", type: "string", required: true },
  { key: "CLOUD_NAME", type: "string", required: true },
  { key: "API_SECRET", type: "string", required: true },
  { key: "MONGO_URI", type: "mongo-uri", required: true },
  { key: "CLIENT_URL", type: "url-list", required: true },
  { key: "BREVO_API_KEY", type: "string", required: true },
  { key: "RT_EXPIRES_IN", type: "duration", default: "30d" },
  { key: "AT_EXPIRES_IN", type: "duration", default: "15m" },
  { key: "BREVO_SENDER_EMAIL", type: "email", required: true },
  { key: "AT_SECRET", type: "string", required: true, minLength: 32 },
  { key: "RT_SECRET", type: "string", required: true, minLength: 32 },
  { key: "BREVO_SENDER_NAME", type: "string", default: "Milk Shop Management" },
];

// <== VALIDATE A SINGLE ENVIRONMENT VARIABLE AGAINST ITS SCHEMA ENTRY ==>
const validateEntry = (entry) => {
  // READING THE RAW VALUE
  const raw = process.env[entry.key] ?? entry.default;
  // MISSING & REQUIRED — NO DEFAULT TO FALL BACK ON
  if ((raw === undefined || raw === "") && entry.required) {
    // INDICATING FAILURE WITH REASON
    return { ok: false, reason: "Missing Required Variable" };
  }
  // MISSING & OPTIONAL — NOTHING TO VALIDATE
  if (raw === undefined || raw === "") {
    // INDICATING SUCCESS WITH DEFAULT VALUE
    return { ok: true, value: raw };
  }
  // TYPE-SPECIFIC VALIDATION
  switch (entry.type) {
    // NUMBER TYPE — MUST PARSE TO A FINITE NUMBER
    case "number": {
      // TRYING TO PARSE TO A NUMBER
      const parsed = Number(raw);
      // CHECKING FOR FAILURE OR INFINITY
      if (!Number.isFinite(parsed)) {
        // INDICATING FAILURE WITH REASON
        return { ok: false, reason: `Expected a Number, got "${raw}"` };
      }
      // INDICATING SUCCESS WITH PARSED VALUE
      return { ok: true, value: parsed };
    }
    // ENUM TYPE — MUST BE ONE OF THE ALLOWED OPTIONS
    case "enum": {
      // CHECKING AGAINST ALLOWED OPTIONS
      if (!entry.options.includes(raw)) {
        // INDICATING FAILURE WITH REASON
        return {
          ok: false,
          reason: `Expected one of [${entry.options.join(", ")}], got "${raw}"`,
        };
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
    // DURATION TYPE — MUST BE A VALID DURATION
    case "duration": {
      // CHECKING AGAINST ALLOWED OPTIONS
      if (!DURATION_PATTERN.test(raw.trim())) {
        // INDICATING FAILURE WITH REASON
        return {
          ok: false,
          reason: `Expected a Duration like "15m", "1h", or "30d", got "${raw}"`,
        };
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
    // EMAIL TYPE — BASIC FORMAT CHECK
    case "email": {
      // CHECKING AGAINST ALLOWED OPTIONS
      if (!EMAIL_PATTERN.test(raw)) {
        // INDICATING FAILURE WITH REASON
        return { ok: false, reason: `Expected a Valid Email, got "${raw}"` };
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
    // MONGO URI TYPE — MUST BE A VALID CONNECTION STRING
    case "mongo-uri": {
      // CHECKING AGAINST ALLOWED OPTIONS
      if (!MONGO_URI_PATTERN.test(raw.trim())) {
        // INDICATING FAILURE WITH REASON
        return {
          ok: false,
          reason: "Expected a mongodb:// or mongodb+srv:// connection string",
        };
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
    // URL LIST TYPE — COMMA-SEPARATED LIST, EVERY ENTRY MUST BE A VALID URL
    case "url-list": {
      // SPLITTING AND TRIMMING EACH CANDIDATE ORIGIN
      const candidates = raw
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);
      // REQUIRING AT LEAST ONE VALID ORIGIN
      if (candidates.length === 0) {
        // INDICATING FAILURE WITH REASON
        return {
          ok: false,
          reason: "Expected at least one comma-separated URL",
        };
      }
      // VALIDATING EVERY CANDIDATE ORIGIN
      for (const candidate of candidates) {
        // CHECKING AGAINST ALLOWED OPTIONS
        try {
          // TRYING TO PARSE THE URL
          new URL(candidate);
        } catch {
          // INDICATING FAILURE WITH REASON
          return { ok: false, reason: `"${candidate}" is not a valid URL` };
        }
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
    // STRING TYPE — OPTIONAL MINIMUM LENGTH CHECK
    default: {
      // CHECKING FOR MINIMUM LENGTH
      if (entry.minLength && raw.length < entry.minLength) {
        // INDICATING FAILURE WITH REASON
        return {
          ok: false,
          reason: `Expected at least ${entry.minLength} characters, got ${raw.length}`,
        };
      }
      // INDICATING SUCCESS WITH RAW VALUE
      return { ok: true, value: raw };
    }
  }
};

// <== RUNNING VALIDATION ACROSS THE FULL SCHEMA ==>
const errors = [];
// <== STORAGE FOR VALIDATED VARIABLES ==>
const validated = {};

// VALIDATING EVERY SCHEMA ENTRY
envSchema.forEach((entry) => {
  // VALIDATING THE CURRENT ENTRY
  const result = validateEntry(entry);
  // COLLECTING FAILURES INSTEAD OF THROWING IMMEDIATELY
  if (!result.ok) {
    // ADDING THE FAILURE TO THE ERROR LIST
    errors.push(`  - ${entry.key}: ${result.reason}`);
    // RETURNING FROM FUNCTION
    return;
  }
  // STORING THE VALIDATED VALUE UNDER ITS SCHEMA KEY
  validated[entry.key] = result.value;
});

// <== CROSS-FIELD CHECK: ACCESS AND REFRESH SECRETS MUST NOT BE IDENTICAL ==>
if (
  validated.AT_SECRET &&
  validated.RT_SECRET &&
  validated.AT_SECRET === validated.RT_SECRET
) {
  // ADDING THE FAILURE TO THE ERROR LIST
  errors.push(
    "  - AT_SECRET / RT_SECRET: Must not be Identical — using the same Secret for both Tokens Defeats Independent Revocation",
  );
}

// <== FAILING FAST ON VALIDATION ERRORS ==>
if (errors.length > 0) {
  // LOGGING EVERY INVALID/MISSING VARIABLE BEFORE CRASHING
  console.error("❌ Environment Validation Failed:\n" + errors.join("\n"));
  // REFUSING TO START THE SERVER WITH AN INVALID CONFIGURATION
  process.exit(1);
}

// <== CONFIRMATION LOG ==>
console.log("✅ Environment Validation Passed");

// <== FROZEN, TYPED ENVIRONMENT OBJECT ==>
export const env = Object.freeze(validated);
